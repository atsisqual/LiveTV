package com.atsisqual.livetv.shaka;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/index.html";

    private FrameLayout root;
    private WebView web;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private volatile Map<String, String> playbackHeaders = Collections.emptyMap();
    private volatile boolean playerMode = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        configureWebView();
        web.loadUrl(HOME);
    }

    private void configureWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.addJavascriptInterface(new NativeBridge(), "LiveTVNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                    return super.shouldInterceptRequest(view, request);
                }
                if (!"GET".equalsIgnoreCase(request.getMethod())) {
                    return super.shouldInterceptRequest(view, request);
                }
                try {
                    return fetchForWebView(request);
                } catch (Exception ignored) {
                    return super.shouldInterceptRequest(view, request);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                web.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                applyImmersiveUi();
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });
    }

    private WebResourceResponse fetchForWebView(WebResourceRequest request) throws Exception {
        final HttpURLConnection connection = (HttpURLConnection) new URL(request.getUrl().toString()).openConnection();
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(45_000);
        connection.setInstanceFollowRedirects(true);
        connection.setUseCaches(false);
        connection.setRequestMethod("GET");

        for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
            String key = entry.getKey();
            if (key == null) continue;
            String lower = key.toLowerCase(Locale.ROOT);
            if (lower.equals("host") || lower.equals("connection") || lower.equals("content-length")) continue;
            try {
                connection.setRequestProperty(key, entry.getValue());
            } catch (Exception ignored) {}
        }

        String host = request.getUrl().getHost();
        boolean mediaLike = host != null && !host.equalsIgnoreCase("raw.githubusercontent.com");
        if (mediaLike) {
            for (Map.Entry<String, String> entry : playbackHeaders.entrySet()) {
                connection.setRequestProperty(entry.getKey(), entry.getValue());
            }
        }

        int code = connection.getResponseCode();
        InputStream raw = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (raw == null) raw = new ByteArrayInputStream(new byte[0]);

        InputStream body = new FilterInputStream(raw) {
            @Override
            public void close() throws IOException {
                try {
                    super.close();
                } finally {
                    connection.disconnect();
                }
            }
        };

        String contentType = connection.getContentType();
        String mime = "application/octet-stream";
        String encoding = "UTF-8";
        if (contentType != null) {
            String[] parts = contentType.split(";");
            if (parts.length > 0 && !parts[0].trim().isEmpty()) mime = parts[0].trim();
            for (String part : parts) {
                String p = part.trim().toLowerCase(Locale.ROOT);
                if (p.startsWith("charset=")) encoding = part.substring(part.indexOf('=') + 1).trim();
            }
        }

        Map<String, String> responseHeaders = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) continue;
            responseHeaders.put(entry.getKey(), entry.getValue().get(0));
        }
        responseHeaders.put("Access-Control-Allow-Origin", "*");
        responseHeaders.put("Access-Control-Allow-Headers", "*");

        String reason = connection.getResponseMessage();
        if (reason == null || reason.trim().isEmpty()) reason = code >= 400 ? "HTTP Error" : "OK";
        return new WebResourceResponse(mime, encoding, code, reason, responseHeaders, body);
    }

    private void applyImmersiveUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void leaveImmersiveUi() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    }

    private void enterPlaybackModeNative() {
        playerMode = true;
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        applyImmersiveUi();
    }

    private void exitPlaybackModeNative() {
        playerMode = false;
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        leaveImmersiveUi();
    }

    private void enterPictureInPictureNative() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !playerMode || isInPictureInPictureMode()) return;
        try {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .build();
            enterPictureInPictureMode(params);
        } catch (Exception ignored) {}
    }

    private void setWindowBrightnessNative(double value) {
        float brightness = (float) Math.max(0.08d, Math.min(1.0d, value));
        WindowManager.LayoutParams attrs = getWindow().getAttributes();
        attrs.screenBrightness = brightness;
        getWindow().setAttributes(attrs);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (web == null) return;
        if (isInPictureInPictureMode) {
            web.evaluateJavascript("document.getElementById('operatorUi')?.classList.add('chrome-hidden')", null);
        } else if (playerMode) {
            applyImmersiveUi();
            web.evaluateJavascript("window.LiveTVShowControls?.()", null);
        }
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        web.setVisibility(View.VISIBLE);
        if (playerMode) applyImmersiveUi(); else leaveImmersiveUi();
        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        if (playerMode || getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE) {
            web.evaluateJavascript(
                    "window.LiveTVExitPlayer ? (window.LiveTVExitPlayer(), true) : false",
                    null);
            exitPlaybackModeNative();
            return;
        }
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void setPlaybackHeaders(String json) {
            try {
                JSONObject obj = new JSONObject(json == null ? "{}" : json);
                Map<String, String> next = new HashMap<>();
                putIfPresent(next, "User-Agent", obj.optString("userAgent", ""));
                putIfPresent(next, "Referer", obj.optString("referer", ""));
                putIfPresent(next, "Origin", obj.optString("origin", ""));
                playbackHeaders = Collections.unmodifiableMap(next);
            } catch (Exception ignored) {
                playbackHeaders = Collections.emptyMap();
            }
        }

        @JavascriptInterface
        public void clearPlaybackHeaders() {
            playbackHeaders = Collections.emptyMap();
        }

        @JavascriptInterface
        public void enterPlaybackMode() {
            runOnUiThread(() -> enterPlaybackModeNative());
        }

        @JavascriptInterface
        public void exitPlaybackMode() {
            runOnUiThread(() -> exitPlaybackModeNative());
        }

        @JavascriptInterface
        public void enterPictureInPicture() {
            runOnUiThread(() -> enterPictureInPictureNative());
        }

        @JavascriptInterface
        public void setBrightness(double value) {
            runOnUiThread(() -> setWindowBrightnessNative(value));
        }

        private void putIfPresent(Map<String, String> target, String key, String value) {
            if (value != null && !value.trim().isEmpty()) target.put(key, value.trim());
        }
    }
}
