package cn.jiujiu.personalplayer;

import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

@CapacitorPlugin(name = "NativeAudioPlayer")
public class NativeAudioPlayerPlugin extends Plugin {
    private MediaPlayer mediaPlayer;
    private boolean ended = false;
    private float volume = 0.85f;

    @PluginMethod
    public void load(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.trim().isEmpty()) {
            call.reject("Missing audio uri");
            return;
        }

        Double requestedVolume = call.getDouble("volume", (double) volume);
        volume = clampVolume(requestedVolume.floatValue());

        try {
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
            mediaPlayer.setOnCompletionListener((player) -> ended = true);
            mediaPlayer.prepare();
            ended = false;

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

        if (ended) {
            mediaPlayer.seekTo(0);
            ended = false;
        }
        mediaPlayer.start();
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
        }
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
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        releaseCurrentPlayer();
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
    }
}
