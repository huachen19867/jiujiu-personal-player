package cn.jiujiu.personalplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class PlaybackForegroundService extends Service {
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_PLAYLIST = "playlist";

    private static final String CHANNEL_ID = "native_audio_player";
    private static final int NOTIFICATION_ID = 9901;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureNotificationChannel();
        String title = intent == null ? null : intent.getStringExtra(EXTRA_TITLE);
        String playlist = intent == null ? null : intent.getStringExtra(EXTRA_PLAYLIST);
        startForeground(NOTIFICATION_ID, buildNotification(title, playlist));
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification(String title, String playlist) {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(this, MainActivity.class);
        }
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        Notification.Builder builder =
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        return builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(isBlank(title) ? "99新自用唱机" : title)
            .setContentText(isBlank(playlist) ? "本地歌单" : playlist)
            .setContentIntent(PendingIntent.getActivity(this, 11, launchIntent, pendingIntentFlags()))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setShowWhen(false)
            .setOngoing(true)
            .build();
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "本地音乐播放",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("显示锁屏和状态栏播放控制");
        manager.createNotificationChannel(channel);
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
