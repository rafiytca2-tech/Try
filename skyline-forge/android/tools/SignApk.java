import com.android.apksig.ApkSigner;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Signs an APK with APK Signature Scheme v2 using apksig from Maven Central. v1 (JAR) signing is
 * only needed below Android 7.0, and apksig 2.3.0's v1 signer calls JDK internals removed after JDK 8.
 */
public class SignApk {
    public static void main(String[] a) throws Exception {
        if (a.length != 7) {
            System.err.println("usage: SignApk <in.apk> <out.apk> <keystore> <storepass> <alias> <keypass> <minSdk>");
            System.exit(2);
        }
        KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
        try (FileInputStream in = new FileInputStream(a[2])) {
            ks.load(in, a[3].toCharArray());
        }
        PrivateKey key = (PrivateKey) ks.getKey(a[4], a[5].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[4]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("CERT", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(a[0]))
                .setOutputApk(new File(a[1]))
                .setMinSdkVersion(Integer.parseInt(a[6]))
                .setV1SigningEnabled(Integer.parseInt(a[6]) < 24)
                .setV2SigningEnabled(true)
                .build()
                .sign();
    }
}
