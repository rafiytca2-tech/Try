import com.android.apksig.ApkVerifier;

import java.io.File;

/** Verifies v1/v2 signatures with apksig, the same library Android's apksigner is built on. */
public class VerifyApk {
    public static void main(String[] a) throws Exception {
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[0]))
                .setMinCheckedPlatformVersion(Integer.parseInt(a[1]))
                .setMaxCheckedPlatformVersion(Integer.parseInt(a[2]))
                .build()
                .verify();
        System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
        for (Object e : r.getErrors()) System.out.println("error: " + e);
        for (Object w : r.getWarnings()) System.out.println("warning: " + w);
        System.exit(r.isVerified() ? 0 : 1);
    }
}
