package cn.jiujiu.personalplayer;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocalMusicPicker")
public class LocalMusicPickerPlugin extends Plugin {
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
            for (int index = 0; index < count; index++) {
                Uri uri = data.getClipData().getItemAt(index).getUri();
                songs.put(toSongObject(uri));
            }
        } else if (data.getData() != null) {
            songs.put(toSongObject(data.getData()));
        }

        JSObject payload = new JSObject();
        payload.put("songs", songs);
        call.resolve(payload);
    }

    private JSObject toSongObject(Uri uri) {
        takePersistableReadPermission(uri);

        String name = queryDisplayName(uri);
        String type = queryMimeType(uri, name);
        long size = querySize(uri);

        JSObject song = new JSObject();
        song.put("id", "android-" + Math.abs(uri.toString().hashCode()) + "-" + System.nanoTime());
        song.put("name", name);
        song.put("type", type);
        song.put("size", size);
        song.put("uri", uri.toString());
        return song;
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
