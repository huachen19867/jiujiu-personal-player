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
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

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

    private MediaPlayer mediaPlayer;
    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private BroadcastReceiver commandReceiver;
    private boolean receiverRegistered = false;
    private boolean ended = false;
    private float volume = 0.85f;
    private String currentTitle = "99新自用唱机";
    private String currentPlaylist = "本地歌单";

    @PluginMethod
    public void load(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.trim().isEmpty()) {
            call.reject("Missing audio uri");
            return;
        }

        Double requestedVolume = call.getDouble("volume", (double) volume);
        volume = clampVolume(requestedVolume.floatValue());
        currentTitle = call.getString("title", currentTitle);
        currentPlaylist = call.getString("playlist", currentPlaylist);

        try {
            ensureMediaSession();
            releaseCurrentPlayer();
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            );
            mediaPlayer.setWakeMode(getContext(), PowerManager.PARTIAL_WAKE_LOCK);
            mediaPlayer.setDataSource(getContext(), Uri.parse(uri));
            mediaPlayer.setVolume(volume, volume);
            mediaPlayer.setOnCompletionListener((player) -> {
                ended = true;
                updateMediaSession(false);
                showMediaNotification(false);
                notifyPlaybackEvent("ended");
            });
            mediaPlayer.prepare();
            ended = false;
            updateMediaSession(false);

            JSObject result = new JSObject();
            result.put("duration", mediaPlayer.getDuration() / 1000.0);
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
    public void getState(PluginCall call) {
        JSObject state = new JSObject();
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
                    notifyPlaybackEvent("next");
                }

                @Override
                public void onSkipToPrevious() {
                    notifyPlaybackEvent("previous");
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
            notifyPlaybackEvent("next");
            return;
        }
        if (COMMAND_PREVIOUS.equals(command)) {
            notifyPlaybackEvent("previous");
        }
    }

    private void notifyPlaybackEvent(String eventName) {
        JSObject event = new JSObject();
        event.put("title", currentTitle);
        event.put("playlist", currentPlaylist);
        event.put("isPlaying", mediaPlayer != null && mediaPlayer.isPlaying());
        notifyListeners(eventName, event);
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
}
