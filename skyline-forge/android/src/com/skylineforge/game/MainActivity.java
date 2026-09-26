package com.skylineforge.game;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen WebView host for Skyline Forge. The game, three.js and its fonts ship inside
 * the APK's assets, so it runs offline. Compiled against the API 16 stubs, so newer APIs are
 * reached through raw constants or reflection.
 */
public class MainActivity extends Activity {
    private static final String GAME_URL = "file:///android_asset/index.html";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B1118);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // saves: best score, settings, tips
        s.setAllowFileAccess(true);            // off by default from Android 11; needed for android_asset
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        callIfPresent(s, "setMediaPlaybackRequiresUserGesture", false);   // API 17+

        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new PhotoBridge(this), "SkylineNative");   // Photo Mode: save and share
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("skyline://exit")) {
                    finish();
                    return true;
                }
                return !url.startsWith("file:///android_asset/");   // keep everything else out of the game view
            }
        });

        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl(GAME_URL);
        hideSystemUi();
    }

    private static void callIfPresent(Object target, String method, boolean value) {
        try {
            target.getClass().getMethod(method, boolean.class).invoke(target, value);
        } catch (Exception ignored) {
            // Older WebView without this setting.
        }
    }

    private void hideSystemUi() {
        // SYSTEM_UI_FLAG_* values, written out so they compile against old stubs.
        int flags = 0x00000002      // HIDE_NAVIGATION
                | 0x00000004        // FULLSCREEN
                | 0x00000100        // LAYOUT_STABLE
                | 0x00000200        // LAYOUT_HIDE_NAVIGATION
                | 0x00000400;       // LAYOUT_FULLSCREEN
        if (Build.VERSION.SDK_INT >= 19) flags |= 0x00001000;   // IMMERSIVE_STICKY
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public void onBackPressed() {
        // The page decides: pause the build, step back through menus, or exit via skyline://exit.
        web.loadUrl("javascript:window.skylineBack&&window.skylineBack()");
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();          // fires visibilitychange, which pauses the game
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
        hideSystemUi();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
