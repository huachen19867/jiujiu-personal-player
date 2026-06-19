package cn.jiujiu.personalplayer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalMusicPickerPlugin.class);
        registerPlugin(NativeAudioPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
