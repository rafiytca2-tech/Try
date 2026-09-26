package com.skylineforge.game;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Photo Mode pictures from the page: saved to Pictures/Skyline Forge (Android 10+, no permission
 * needed) or to the app's own pictures folder on older phones, and optionally shared.
 */
public class PhotoBridge {
    private final Activity activity;

    PhotoBridge(Activity activity) {
        this.activity = activity;
    }

    /** Returns where the picture went, or an empty string if it could not be saved. */
    @JavascriptInterface
    public String savePhoto(String dataUrl, boolean share) {
        try {
            byte[] png = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
            String name = "SkylineForge_" + System.currentTimeMillis() + ".png";
            Uri uri = null;
            String where;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver cr = activity.getContentResolver();
                ContentValues v = new ContentValues();
                v.put("_display_name", name);
                v.put("mime_type", "image/png");
                v.put("relative_path", "Pictures/Skyline Forge");   // MediaStore.MediaColumns.RELATIVE_PATH
                v.put("is_pending", 1);
                uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "";
                OutputStream out = cr.openOutputStream(uri);
                try {
                    out.write(png);
                } finally {
                    out.close();
                }
                ContentValues done = new ContentValues();
                done.put("is_pending", 0);
                cr.update(uri, done, null, null);
                where = "Pictures/Skyline Forge";
            } else {
                File dir = activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES);
                if (dir == null) return "";
                File f = new File(dir, name);
                FileOutputStream out = new FileOutputStream(f);
                try {
                    out.write(png);
                } finally {
                    out.close();
                }
                where = f.getAbsolutePath();
            }
            if (share && uri != null) {
                final Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        activity.startActivity(Intent.createChooser(send, "Share your skyline"));
                    }
                });
            }
            return where;
        } catch (Exception e) {
            return "";
        }
    }
}
