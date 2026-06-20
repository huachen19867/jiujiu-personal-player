package cn.jiujiu.personalplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeAudioPlayer")
public class NativeAudioPlayerPlugin extends Plugin {
    private static final String CHANNEL_ID = "native_audio_player";
    private static final int NOTIFICATION_ID = 9901;
    private static final String COMMAND_ACTION = "cn.jiujiu.personalplayer.NATIVE_AUDIO_COMMAND";
    private static final String EXTRA_COMMAND = "command";
    private static final String COMMAND_PLAY = "play";
    private static final String COMMAND_PAUSE = "pause";
    private static final String COMMAND_TOGGLE = "toggle";
    private static final String COMMAND_NEXT = "next";
    private static final String COMMAND_PREVIOUS = "previous";

    private final List<NativeTrack> playbackQueue = new ArrayList<>();
    private final Random random = new Random();
    private MediaPlayer mediaPlayer;
    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private BroadcastReceiver commandReceiver;
    private boolean receiverRegistered = false;
    private boolean ended = false;
    private float volume = 0.85f;
    private String playbackMode = "sequence";
    private String currentTitle = "99新自用唱机";
    private String currentPlaylist = "本地歌单";
    private String currentSongId = "";
    private String currentPlaylistId = "";
    private int currentSongIndex = -1;
    private int playbackQueueIndex = -1;

    @PluginMethod
    public void load(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.trim().isEmpty()) {
            call.reject("Missing audio uri");
            return;
        }

        Double requestedVolume = call.getDouble("volume", (double) volume);
        volume = clampVolume(requestedVolume.floatValue());
        applyQueueFromCall(call);

        NativeTrack track = currentTrackFromCall(call, uri);
        try {
            ensureMediaSession();
            loadTrack(track, false, false);
            JSObject result = new JSObject();
            result.put("duration", mediaPlayer == null ? 0 : mediaPlayer.getDuration() / 1000.0);
            call.resolve(result);
        } catch (IOException | IllegalArgumentException | IllegalStateException error) {
            releaseCurrentPlayer();
            call.reject("Unable to load audio", error);
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (mediaPlayer == null) {
            call.reject("No audio loaded");
            return;
        }

        startPlayback(false);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        pausePlayback(false);
        call.resolve();
    }

    @PluginMethod
    public void seek(PluginCall call) {
        if (mediaPlayer == null) {
            call.reject("No audio loaded");
            return;
        }

        Double position = call.getDouble("position", 0.0);
        mediaPlayer.seekTo(Math.max(0, (int) Math.round(position * 1000)));
        ended = false;
        updateMediaSession(mediaPlayer.isPlaying());
        showMediaNotification(mediaPlayer.isPlaying());
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double requestedVolume = call.getDouble("volume", (double) volume);
        volume = clampVolume(requestedVolume.floatValue());
        if (mediaPlayer != null) {
            mediaPlayer.setVolume(volume, volume);
        }
        call.resolve();
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        applyQueueFromCall(call);
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject state = new JSObject();
        state.put("songId", currentSongId);
        state.put("playlistId", currentPlaylistId);
        state.put("songIndex", currentSongIndex);

        if (mediaPlayer == null) {
            state.put("currentTime", 0);
            state.put("duration", 0);
            state.put("isPlaying", false);
            state.put("ended", ended);
            call.resolve(state);
            return;
        }

        state.put("currentTime", mediaPlayer.getCurrentPosition() / 1000.0);
        state.put("duration", mediaPlayer.getDuration() / 1000.0);
        state.put("isPlaying", mediaPlayer.isPlaying());
        state.put("ended", ended);
        call.resolve(state);
    }

    @PluginMethod
    public void release(PluginCall call) {
        releaseCurrentPlayer();
        cancelMediaNotification();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        releaseCurrentPlayer();
        cancelMediaNotification();
        unregisterCommandReceiver();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
    }

    private void startPlayback(boolean emitEvent) {
        if (mediaPlayer == null) {
            return;
        }

        if (ended) {
            mediaPlayer.seekTo(0);
            ended = false;
        }
        mediaPlayer.start();
        updateMediaSession(true);
        showMediaNotification(true);
        if (emitEvent) {
            notifyPlaybackEvent("play");
        }
    }

    private void pausePlayback(boolean emitEvent) {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
        }
        updateMediaSession(false);
        showMediaNotification(false);
        if (emitEvent) {
            notifyPlaybackEvent("pause");
        }
    }

    private void loadTrack(NativeTrack track, boolean shouldPlay, boolean emitTrackChanged) throws IOException {
        releaseCurrentPlayer();
        currentTitle = track.title;
        currentPlaylist = track.playlist;
        currentSongId = track.songId;
        currentPlaylistId = track.playlistId;
        currentSongIndex = track.songIndex;

        mediaPlayer = new MediaPlayer();
        mediaPlayer.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        );
        mediaPlayer.setWakeMode(getContext(), PowerManager.PARTIAL_WAKE_LOCK);
        mediaPlayer.setDataSource(getContext(), Uri.parse(track.uri));
        mediaPlayer.setVolume(volume, volume);
        mediaPlayer.setOnCompletionListener((player) -> {
            if (moveInQueue(1, true)) {
                return;
            }
            ended = true;
            updateMediaSession(false);
            showMediaNotification(false);
            notifyPlaybackEvent("ended");
        });
        mediaPlayer.prepare();
        ended = false;
        if (shouldPlay) {
            mediaPlayer.start();
        }
        updateMediaSession(shouldPlay);
        showMediaNotification(shouldPlay);
        if (emitTrackChanged) {
            notifyPlaybackEvent("trackChanged");
        }
    }

    private boolean moveInQueue(int direction, boolean shouldPlay) {
        NativeTrack target = getQueueTarget(direction);
        if (target == null) {
            return false;
        }

        try {
            loadTrack(target, shouldPlay, true);
            return true;
        } catch (IOException | IllegalArgumentException | IllegalStateException error) {
            return false;
        }
    }

    private NativeTrack getQueueTarget(int direction) {
        if (playbackQueue.isEmpty()) {
            return null;
        }

        if ("repeat-one".equals(playbackMode) && playbackQueueIndex >= 0 && playbackQueueIndex < playbackQueue.size()) {
            return playbackQueue.get(playbackQueueIndex);
        }

        int targetIndex;
        if (playbackQueueIndex < 0 || playbackQueueIndex >= playbackQueue.size()) {
            targetIndex = direction > 0 ? 0 : playbackQueue.size() - 1;
        } else if ("shuffle".equals(playbackMode)) {
            targetIndex = randomQueueIndex();
        } else {
            targetIndex = playbackQueueIndex + direction;
            if (targetIndex < 0 || targetIndex >= playbackQueue.size()) {
                if (!"repeat-all".equals(playbackMode)) {
                    return null;
                }
                targetIndex = targetIndex < 0 ? playbackQueue.size() - 1 : 0;
            }
        }

        playbackQueueIndex = targetIndex;
        return playbackQueue.get(targetIndex);
    }

    private int randomQueueIndex() {
        if (playbackQueue.size() <= 1) {
            return 0;
        }

        int nextIndex = playbackQueueIndex;
        while (nextIndex == playbackQueueIndex) {
            nextIndex = random.nextInt(playbackQueue.size());
        }
        return nextIndex;
    }

    private void ensureMediaSession() {
        if (notificationManager == null) {
            notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        }
        ensureNotificationChannel();
        ensureCommandReceiver();
        if (mediaSession != null) {
            return;
        }

        mediaSession = new MediaSession(getContext(), "NativeAudioPlayer");
        mediaSession.setCallback(
            new MediaSession.Callback() {
                @Override
                public void onPlay() {
                    startPlayback(true);
                }

                @Override
                public void onPause() {
                    pausePlayback(true);
                }

                @Override
                public void onSkipToNext() {
                    boolean shouldPlay = mediaPlayer != null && mediaPlayer.isPlaying();
                    if (!moveInQueue(1, shouldPlay)) {
                        notifyPlaybackEvent("next");
                    }
                }

                @Override
                public void onSkipToPrevious() {
                    boolean shouldPlay = mediaPlayer != null && mediaPlayer.isPlaying();
                    if (!moveInQueue(-1, shouldPlay)) {
                        notifyPlaybackEvent("previous");
                    }
                }

                @Override
                public void onSeekTo(long pos) {
                    if (mediaPlayer == null) {
                        return;
                    }
                    mediaPlayer.seekTo(Math.max(0, (int) pos));
                    ended = false;
                    updateMediaSession(mediaPlayer.isPlaying());
                    showMediaNotification(mediaPlayer.isPlaying());
                }
            }
        );
        mediaSession.setActive(true);
    }

    private void updateMediaSession(boolean isPlaying) {
        if (mediaSession == null) {
            return;
        }

        long duration = mediaPlayer == null ? -1L : mediaPlayer.getDuration();
        long position = mediaPlayer == null ? 0L : mediaPlayer.getCurrentPosition();
        mediaSession.setMetadata(
            new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, currentPlaylist)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, duration)
                .build()
        );
        mediaSession.setPlaybackState(
            new PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY
                        | PlaybackState.ACTION_PAUSE
                        | PlaybackState.ACTION_PLAY_PAUSE
                        | PlaybackState.ACTION_SKIP_TO_NEXT
                        | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                        | PlaybackState.ACTION_SEEK_TO
                )
                .setState(
                    isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                    position,
                    isPlaying ? 1f : 0f
                )
                .build()
        );
    }

    private void showMediaNotification(boolean isPlaying) {
        if (mediaSession == null || notificationManager == null) {
            return;
        }

        Intent launchIntent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(getContext(), MainActivity.class);
        }
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        Notification.Builder builder =
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(getContext(), CHANNEL_ID)
                : new Notification.Builder(getContext());

        builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle)
            .setContentText(currentPlaylist)
            .setContentIntent(PendingIntent.getActivity(getContext(), 10, launchIntent, pendingIntentFlags()))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setShowWhen(false)
            .setOngoing(isPlaying)
            .addAction(makeNotificationAction(android.R.drawable.ic_media_previous, "上一首", COMMAND_PREVIOUS))
            .addAction(
                makeNotificationAction(
                    isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                    isPlaying ? "暂停" : "播放",
                    isPlaying ? COMMAND_PAUSE : COMMAND_PLAY
                )
            )
            .addAction(makeNotificationAction(android.R.drawable.ic_media_next, "下一首", COMMAND_NEXT))
            .setStyle(
                new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            );

        try {
            notificationManager.notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // Some Android builds still gate media notifications behind the app notification switch.
        }
    }

    private Notification.Action makeNotificationAction(int icon, String title, String command) {
        return new Notification.Action.Builder(icon, title, commandIntent(command)).build();
    }

    private PendingIntent commandIntent(String command) {
        Intent intent = new Intent(COMMAND_ACTION);
        intent.setPackage(getContext().getPackageName());
        intent.putExtra(EXTRA_COMMAND, command);
        return PendingIntent.getBroadcast(getContext(), command.hashCode(), intent, pendingIntentFlags());
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "本地音乐播放",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("显示锁屏和状态栏播放控制");
        notificationManager.createNotificationChannel(channel);
    }

    private void ensureCommandReceiver() {
        if (receiverRegistered) {
            return;
        }

        commandReceiver =
            new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (!COMMAND_ACTION.equals(intent.getAction())) {
                        return;
                    }
                    handleCommand(intent.getStringExtra(EXTRA_COMMAND));
                }
            };
        IntentFilter filter = new IntentFilter(COMMAND_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(commandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(commandReceiver, filter);
        }
        receiverRegistered = true;
    }

    private void handleCommand(String command) {
        if (COMMAND_PLAY.equals(command)) {
            startPlayback(true);
            return;
        }
        if (COMMAND_PAUSE.equals(command)) {
            pausePlayback(true);
            return;
        }
        if (COMMAND_TOGGLE.equals(command)) {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                pausePlayback(true);
            } else {
                startPlayback(true);
            }
            return;
        }
        if (COMMAND_NEXT.equals(command)) {
            boolean shouldPlay = mediaPlayer != null && mediaPlayer.isPlaying();
            if (!moveInQueue(1, shouldPlay)) {
                notifyPlaybackEvent("next");
            }
            return;
        }
        if (COMMAND_PREVIOUS.equals(command)) {
            boolean shouldPlay = mediaPlayer != null && mediaPlayer.isPlaying();
            if (!moveInQueue(-1, shouldPlay)) {
                notifyPlaybackEvent("previous");
            }
        }
    }

    private void notifyPlaybackEvent(String eventName) {
        JSObject event = new JSObject();
        event.put("title", currentTitle);
        event.put("playlist", currentPlaylist);
        event.put("songId", currentSongId);
        event.put("playlistId", currentPlaylistId);
        event.put("songIndex", currentSongIndex);
        event.put("currentTime", mediaPlayer == null ? 0 : mediaPlayer.getCurrentPosition() / 1000.0);
        event.put("duration", mediaPlayer == null ? 0 : mediaPlayer.getDuration() / 1000.0);
        event.put("isPlaying", mediaPlayer != null && mediaPlayer.isPlaying());
        notifyListeners(eventName, event);
    }

    private void applyQueueFromCall(PluginCall call) {
        playbackMode = call.getString("playbackMode", playbackMode);
        Integer requestedQueueIndex = call.getInt("queueIndex", playbackQueueIndex);
        JSArray queue = call.getArray("queue", null);
        if (queue == null) {
            playbackQueueIndex = requestedQueueIndex;
            return;
        }

        playbackQueue.clear();
        for (int i = 0; i < queue.length(); i++) {
            try {
                JSONObject item = queue.getJSONObject(i);
                NativeTrack track = NativeTrack.from(item);
                if (track != null) {
                    playbackQueue.add(track);
                }
            } catch (JSONException ignored) {
                // Ignore malformed queue entries; the web layer will send the next full queue update.
            }
        }
        playbackQueueIndex = requestedQueueIndex == null ? -1 : requestedQueueIndex;
    }

    private NativeTrack currentTrackFromCall(PluginCall call, String uri) {
        Integer songIndex = call.getInt("songIndex", currentSongIndex);
        NativeTrack track = new NativeTrack(
            call.getString("songId", currentSongId),
            call.getString("playlistId", currentPlaylistId),
            songIndex == null ? currentSongIndex : songIndex,
            uri,
            call.getString("title", currentTitle),
            call.getString("playlist", currentPlaylist)
        );

        if (playbackQueueIndex >= 0 && playbackQueueIndex < playbackQueue.size()) {
            NativeTrack queueTrack = playbackQueue.get(playbackQueueIndex);
            if (queueTrack.uri.equals(uri)) {
                return queueTrack;
            }
        }

        return track;
    }

    private float clampVolume(float value) {
        return Math.max(0f, Math.min(1f, value));
    }

    private void releaseCurrentPlayer() {
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        ended = false;
        updateMediaSession(false);
    }

    private void cancelMediaNotification() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }

    private void unregisterCommandReceiver() {
        if (!receiverRegistered || commandReceiver == null) {
            return;
        }

        try {
            getContext().unregisterReceiver(commandReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was already unregistered by the OS.
        }
        receiverRegistered = false;
        commandReceiver = null;
    }

    private static final class NativeTrack {
        final String songId;
        final String playlistId;
        final int songIndex;
        final String uri;
        final String title;
        final String playlist;

        NativeTrack(String songId, String playlistId, int songIndex, String uri, String title, String playlist) {
            this.songId = songId == null ? "" : songId;
            this.playlistId = playlistId == null ? "" : playlistId;
            this.songIndex = songIndex;
            this.uri = uri == null ? "" : uri;
            this.title = title == null || title.isEmpty() ? "99新自用唱机" : title;
            this.playlist = playlist == null || playlist.isEmpty() ? "本地歌单" : playlist;
        }

        static NativeTrack from(JSONObject item) {
            String uri = item.optString("uri", "");
            if (uri.trim().isEmpty()) {
                return null;
            }

            return new NativeTrack(
                item.optString("songId", ""),
                item.optString("playlistId", ""),
                item.optInt("songIndex", -1),
                uri,
                item.optString("title", "99新自用唱机"),
                item.optString("playlist", "本地歌单")
            );
        }
    }
}
