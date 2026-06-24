package cn.jiujiu.personalplayer;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "LocalMusicPicker",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_MEDIA_AUDIO }, alias = "audio"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "legacyAudio")
    }
)
public class LocalMusicPickerPlugin extends Plugin {
    private static final int MANUAL_PICK_LIMIT = 1200;
    private static final String MANUAL_PICK_LIMIT_MESSAGE = "一次手动选择的歌曲太多了，请用“自动读取本地”歌单读取手机音乐库。";
    private static final String[] AUDIO_MIME_TYPES = {
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "audio/wav",
        "audio/x-wav",
        "audio/flac",
        "audio/ogg"
    };

    @PluginMethod
    public void pickAudioFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.putExtra(Intent.EXTRA_MIME_TYPES, AUDIO_MIME_TYPES);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        startActivityForResult(call, intent, "pickAudioFilesResult");
    }

    @PluginMethod
    public void scanAudioFiles(PluginCall call) {
        String permissionAlias = getAudioPermissionAlias();
        if (getPermissionState(permissionAlias) != PermissionState.GRANTED) {
            requestPermissionForAlias(permissionAlias, call, "scanAudioFilesPermissionResult");
            return;
        }

        resolveScannedAudioFiles(call);
    }

    @PermissionCallback
    private void scanAudioFilesPermissionResult(PluginCall call) {
        if (getPermissionState(getAudioPermissionAlias()) != PermissionState.GRANTED) {
            call.reject("Audio library permission denied");
            return;
        }

        resolveScannedAudioFiles(call);
    }

    @ActivityCallback
    private void pickAudioFilesResult(PluginCall call, ActivityResult result) {
        JSArray songs = new JSArray();

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject payload = new JSObject();
            payload.put("songs", songs);
            call.resolve(payload);
            return;
        }

        Intent data = result.getData();
        if (data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            if (count > MANUAL_PICK_LIMIT) {
                resolveManualPickLimit(call, count);
                return;
            }

            for (int index = 0; index < count; index++) {
                Uri uri = data.getClipData().getItemAt(index).getUri();
                if (count <= 500) { takePersistableReadPermission(uri); }
                songs.put(toSongObject(uri));
            }
        } else if (data.getData() != null) {
            takePersistableReadPermission(data.getData());
            songs.put(toSongObject(data.getData()));
        }

        JSObject payload = new JSObject();
        payload.put("songs", songs);
        call.resolve(payload);
    }

    private void resolveManualPickLimit(PluginCall call, int count) {
        JSObject payload = new JSObject();
        payload.put("songs", new JSArray());
        payload.put("tooMany", true);
        payload.put("count", count);
        payload.put("message", MANUAL_PICK_LIMIT_MESSAGE);
        call.resolve(payload);
    }

    private void resolveScannedAudioFiles(PluginCall call) {
        JSObject payload = new JSObject();
        payload.put("songs", scanMediaStoreAudioFiles());
        call.resolve(payload);
    }

    private JSArray scanMediaStoreAudioFiles() {
        JSArray songs = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri collection =
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DURATION
        };
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
        String sortOrder = MediaStore.Audio.Media.DATE_ADDED + " DESC";

        try (Cursor cursor = resolver.query(collection, projection, selection, null, sortOrder)) {
            if (cursor == null) {
                return songs;
            }

            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            int typeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);
            int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
            int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);

            while (cursor.moveToNext()) {
                long id = cursor.getLong(idColumn);
                Uri contentUri = ContentUris.withAppendedId(collection, id);
                JSObject song = new JSObject();
                song.put("id", "android-media-" + id);
                song.put("name", readString(cursor, nameColumn, "本地音频"));
                song.put("type", readString(cursor, typeColumn, "audio/*"));
                song.put("size", readLong(cursor, sizeColumn));
                song.put("uri", contentUri.toString());
                long durationMs = readLong(cursor, durationColumn);
                if (durationMs > 0) {
                    song.put("duration", durationMs / 1000.0);
                }
                songs.put(song);
            }
        }

        return songs;
    }

    private JSObject toSongObject(Uri uri) {
        String displayName = uri.getLastPathSegment();
        String name = displayName == null ? "Local Audio" : displayName;
        int slashIdx = name.lastIndexOf('/');
        if (slashIdx >= 0) { name = name.substring(slashIdx + 1); }

        String extension = MimeTypeMap.getFileExtensionFromUrl(name);
        String type = "";
        if (extension != null && !extension.isEmpty()) {
            String extType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (extType != null) { type = extType; }
        }

        JSObject song = new JSObject();
        song.put("id", "android-" + Math.abs(uri.toString().hashCode()) + "-" + System.nanoTime());
        song.put("name", name);
        song.put("type", type);
        song.put("size", 0);
        song.put("uri", uri.toString());
        return song;
    }

    private String getAudioPermissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "legacyAudio";
    }

    private String readString(Cursor cursor, int columnIndex, String fallback) {
        if (columnIndex < 0 || cursor.isNull(columnIndex)) {
            return fallback;
        }

        String value = cursor.getString(columnIndex);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private long readLong(Cursor cursor, int columnIndex) {
        if (columnIndex < 0 || cursor.isNull(columnIndex)) {
            return 0;
        }

        return cursor.getLong(columnIndex);
    }

    private void takePersistableReadPermission(Uri uri) {
        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Some providers grant temporary read access only. The current playback session can still use it.
        }
    }

    private String queryDisplayName(Uri uri) {
        String name = null;
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    name = cursor.getString(nameIndex);
                }
            }
        }

        if (name == null || name.trim().isEmpty()) {
            String lastPath = uri.getLastPathSegment();
            return lastPath == null || lastPath.trim().isEmpty() ? "本地音频" : lastPath;
        }

        return name;
    }

    private long querySize(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                    return cursor.getLong(sizeIndex);
                }
            }
        }

        return 0;
    }

    private String queryMimeType(Uri uri, String name) {
        ContentResolver resolver = getContext().getContentResolver();
        String type = resolver.getType(uri);
        if (type != null && !type.trim().isEmpty()) {
            return type;
        }

        String extension = MimeTypeMap.getFileExtensionFromUrl(name);
        String extensionType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return extensionType == null ? "" : extensionType;
    }
}
