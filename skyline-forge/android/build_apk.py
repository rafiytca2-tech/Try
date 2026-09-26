#!/usr/bin/env python3
"""Build a signed Skyline Forge APK without the Android SDK.

Only a JDK (javac, java, keytool) and Python 3 are needed. Everything else comes from
Maven Central and npm and is cached in android/.cache/:

  * android.jar stubs (com.google.android:android)      -> compile the WebView wrapper
  * dx (com.jakewharton.android.repackaged:dalvik-dx)   -> .class to classes.dex
  * apksig (com.android.tools.build:apksig)             -> APK Signature Scheme v1 + v2
  * three.js r128 and the Barlow fonts from npm         -> bundled so the game runs offline

The binary AndroidManifest.xml and resources.arsc are written by the encoders below.

    python3 skyline-forge/android/build_apk.py            # -> skyline-forge/android/dist/SkylineForge.apk
"""
import base64
import hashlib
import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', 'index.html')
CACHE = os.path.join(HERE, '.cache')
BUILD = os.path.join(HERE, 'build')
DIST = os.path.join(HERE, 'dist')
OUT_APK = os.path.join(DIST, 'SkylineForge.apk')

PACKAGE = 'com.skylineforge.game'
APP_NAME = 'Skyline Forge'
VERSION_CODE = 4
VERSION_NAME = '0.4.0'
MIN_SDK = 24          # Android 7.0: v2 signatures only (apksig's v1 signer needs JDK 8 internals)
TARGET_SDK = 34

# Debug signing key, committed so every build can update the last one in place.
# Fine for sideloading; use your own key before publishing anywhere.
KEYSTORE = os.path.join(HERE, 'debug.keystore')
STOREPASS = KEYPASS = 'android'
ALIAS = 'androiddebugkey'

MAVEN = 'https://repo.maven.apache.org/maven2/'
DEPS = {
    'android.jar': MAVEN + 'com/google/android/android/4.1.1.4/android-4.1.1.4.jar',
    'dx.jar': MAVEN + 'com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'apksig.jar': MAVEN + 'com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
}
THREE_TGZ = 'https://registry.npmjs.org/three/-/three-0.128.0.tgz'
THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
FONTS = [('barlow-condensed', 'Barlow Condensed', (500, 600, 700)), ('barlow', 'Barlow', (400, 500, 600))]


def log(msg):
    print(f'[apk] {msg}', flush=True)


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    log(f'downloading {url}')
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(dest + '.part', 'wb') as f:
            shutil.copyfileobj(r, f)
    except Exception as e:  # fall back to curl, which honours more proxy setups
        log(f'urllib failed ({e}); trying curl')
        subprocess.run(['curl', '-fsSL', '-o', dest + '.part', url], check=True)
    os.replace(dest + '.part', dest)
    return dest


def run(cmd):
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------- binary XML (AXML)
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e,
    'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b,
    'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280,
    'hardwareAccelerated': 0x010102d3,
}
T_REF, T_STRING, T_INT_DEC, T_INT_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def string_pool(strings):
    offsets, data = [], bytearray()
    for s in strings:
        offsets.append(len(data))
        data += struct.pack('<H', len(s)) + s.encode('utf-16-le') + b'\x00\x00'
    while len(data) % 4:
        data += b'\x00'
    start = 28 + 4 * len(strings)
    head = struct.pack('<HHIIIIII', 0x0001, 28, start + len(data), len(strings), 0, 0, start, 0)
    return head + b''.join(struct.pack('<I', o) for o in offsets) + bytes(data)


def element(tag, attrs=(), children=()):
    return {'tag': tag, 'attrs': list(attrs), 'children': list(children)}


def encode_axml(root):
    """attrs are (name, type, value); names starting with 'android:' use the android namespace."""
    android_names, other = [], []

    def collect(e):
        other.append(e['tag'])
        for name, typ, val in e['attrs']:
            if name.startswith('android:'):
                n = name[8:]
                if n not in android_names:
                    android_names.append(n)
            else:
                other.append(name)
            if typ == T_STRING:
                other.append(val)
        for c in e['children']:
            collect(c)
    collect(root)
    android_names.sort(key=lambda n: ATTR_IDS[n])
    strings = list(android_names) + ['android', ANDROID_NS]
    for s in other:
        if s not in strings:
            strings.append(s)
    idx = {s: i for i, s in enumerate(strings)}
    NONE = 0xFFFFFFFF

    chunks = [string_pool(strings)]
    ids = [ATTR_IDS[n] for n in android_names]
    chunks.append(struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(ids)) + b''.join(struct.pack('<I', i) for i in ids))
    chunks.append(struct.pack('<HHIIIII', 0x0100, 16, 24, 1, NONE, idx['android'], idx[ANDROID_NS]))

    def emit(e, line=[1]):
        line[0] += 1
        attrs = []
        for name, typ, val in e['attrs']:
            if name.startswith('android:'):
                ns, n, rid = idx[ANDROID_NS], idx[name[8:]], ATTR_IDS[name[8:]]
            else:
                ns, n, rid = NONE, idx[name], 0
            if typ == T_STRING:
                raw, data = idx[val], idx[val]
            elif typ == T_BOOL:
                raw, data = NONE, 0xFFFFFFFF if val else 0
            else:
                raw, data = NONE, val
            attrs.append((rid, struct.pack('<IIIHBBI', ns, n, raw, 8, 0, typ, data)))
        attrs.sort(key=lambda a: a[0])   # the runtime expects attributes ordered by resource id
        body = b''.join(a[1] for a in attrs)
        chunks.append(struct.pack('<HHIII', 0x0102, 16, 36 + len(body), line[0], NONE)
                      + struct.pack('<IIHHHHHH', NONE, idx[e['tag']], 20, 20, len(attrs), 0, 0, 0) + body)
        for c in e['children']:
            emit(c)
        chunks.append(struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], NONE, NONE, idx[e['tag']]))
    emit(root)
    chunks.append(struct.pack('<HHIIIII', 0x0101, 16, 24, 1, NONE, idx['android'], idx[ANDROID_NS]))
    body = b''.join(chunks)
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body


def manifest():
    config_changes = 0x0010 | 0x0020 | 0x0080 | 0x0100 | 0x0200 | 0x0400 | 0x0800
    return encode_axml(element('manifest', [
        ('package', T_STRING, PACKAGE),
        ('android:versionCode', T_INT_DEC, VERSION_CODE),
        ('android:versionName', T_STRING, VERSION_NAME),
    ], [
        element('uses-sdk', [('android:minSdkVersion', T_INT_DEC, MIN_SDK), ('android:targetSdkVersion', T_INT_DEC, TARGET_SDK)]),
        element('uses-permission', [('android:name', T_STRING, 'android.permission.VIBRATE')]),
        element('application', [
            ('android:label', T_STRING, APP_NAME),
            ('android:icon', T_REF, 0x7f010000),                 # @drawable/icon from resources.arsc
            ('android:theme', T_REF, 0x01030007),                # @android:style/Theme.NoTitleBar.Fullscreen
            ('android:allowBackup', T_BOOL, True),
            ('android:hardwareAccelerated', T_BOOL, True),
        ], [
            element('activity', [
                ('android:name', T_STRING, '.MainActivity'),
                ('android:exported', T_BOOL, True),
                ('android:launchMode', T_INT_DEC, 2),            # singleTask
                ('android:configChanges', T_INT_HEX, config_changes),
            ], [
                element('intent-filter', [], [
                    element('action', [('android:name', T_STRING, 'android.intent.action.MAIN')]),
                    element('category', [('android:name', T_STRING, 'android.intent.category.LAUNCHER')]),
                ]),
            ]),
        ]),
    ]))


# ---------------------------------------------------------------- resources.arsc
def resources_arsc(icon_path):
    """One resource: drawable/icon (0x7f010000) -> icon_path, in the nodpi configuration."""
    values, types, keys = string_pool([icon_path]), string_pool(['drawable']), string_pool(['icon'])
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 20, 1, 0, 0, 1) + struct.pack('<I', 0)
    config = bytearray(64)
    struct.pack_into('<I', config, 0, 64)        # size
    struct.pack_into('<H', config, 14, 0xFFFF)   # density: nodpi
    struct.pack_into('<H', config, 24, 4)        # sdkVersion 4 (nodpi needs it)
    head = 20 + len(config)
    entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STRING, 0)
    typ = struct.pack('<HHIBBHII', 0x0201, head, head + 4 + len(entry), 1, 0, 0, 1, head + 4) + bytes(config) + struct.pack('<I', 0) + entry
    body = types + keys + spec + typ
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\x00')
    pkg = struct.pack('<HHII', 0x0200, 288, 288 + len(body), 0x7f) + name + struct.pack('<IIIII', 288, 1, 288 + len(types), 1, 0) + body
    return struct.pack('<HHII', 0x0002, 12, 12 + len(values) + len(pkg), 1) + values + pkg


# ---------------------------------------------------------------- launcher icon (pure-Python PNG)
def icon_png(size=192):
    px = bytearray(size * size * 4)

    def put(x, y, c, a=255):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            px[i:i + 4] = bytes((c[0], c[1], c[2], a))

    def rect(x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(size, y1)):
            for x in range(max(0, x0), min(size, x1)):
                put(x, y, c)

    s = size / 192
    top, bot = (22, 50, 79), (11, 17, 24)
    for y in range(size):
        k = y / (size - 1)
        c = tuple(round(top[i] + (bot[i] - top[i]) * k) for i in range(3))
        for x in range(size):
            put(x, y, c)
    S = lambda v: round(v * s)
    # stacked residential floors, slightly offset like a real player-built tower
    for i, off in enumerate((0, 3, -2, 2, -1)):
        x0, y0 = S(62 + off), S(160 - (i + 1) * 20)
        rect(x0, y0, x0 + S(60), y0 + S(19), (232, 221, 203))
        rect(x0, y0 + S(16), x0 + S(60), y0 + S(19), (203, 188, 164))
        for b in range(3):
            rect(x0 + S(5 + b * 19), y0 + S(3), x0 + S(17 + b * 19), y0 + S(14), (95, 134, 168))
    # crane jib, cable and the next floor on the hook
    rect(S(18), S(26), S(176), S(34), (255, 194, 26))
    rect(S(34), S(26), S(42), S(170), (255, 194, 26))
    for x in range(S(46), S(176), S(12)):
        rect(x, S(29), x + S(3), S(31), (180, 132, 10))
    rect(S(99), S(34), S(101), S(52), (20, 22, 26))
    rect(S(70), S(52), S(130), S(71), (232, 221, 203))
    rect(S(70), S(68), S(130), S(71), (203, 188, 164))
    for b in range(3):
        rect(S(75 + b * 19), S(55), S(87 + b * 19), S(66), (95, 134, 168))
    # rounded corners
    r = S(38)
    for y in range(size):
        for x in range(size):
            cx = r if x < r else size - 1 - r if x > size - 1 - r else x
            cy = r if y < r else size - 1 - r if y > size - 1 - r else y
            if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                px[(y * size + x) * 4 + 3] = 0
    raw = b''.join(b'\x00' + bytes(px[y * size * 4:(y + 1) * size * 4]) for y in range(size))

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


# ---------------------------------------------------------------- offline web assets
def npm_tarball(pkg):
    meta = json.load(urllib.request.urlopen(f'https://registry.npmjs.org/{pkg.replace("/", "%2f")}', timeout=60))
    ver = meta['dist-tags']['latest']
    return meta['versions'][ver]['dist']['tarball'], ver


def font_css():
    rules = []
    for pkg, family, weights in FONTS:
        url, ver = npm_tarball(f'@fontsource/{pkg}')
        tgz = fetch(url, os.path.join(CACHE, f'fontsource-{pkg}-{ver}.tgz'))
        with tarfile.open(tgz) as t:
            for w in weights:
                data = t.extractfile(f'package/files/{pkg}-latin-{w}-normal.woff2').read()
                b64 = base64.b64encode(data).decode()
                rules.append(f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{w};font-display:swap;'
                             f'src:url(data:font/woff2;base64,{b64}) format("woff2")}}')
    return '\n'.join(rules)


def game_assets():
    html = open(GAME, encoding='utf-8').read()
    html = html.replace(THREE_CDN, 'three.min.js')
    html = re.sub(r'<link rel="preconnect"[^>]*>\n', '', html)
    html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n', '<style>\n' + font_css() + '\n</style>\n', html)
    if 'cdnjs.cloudflare.com' in html or 'fonts.googleapis.com' in html:
        sys.exit('game still references the network; update the rewrite rules in build_apk.py')
    tgz = fetch(THREE_TGZ, os.path.join(CACHE, 'three-0.128.0.tgz'))
    with tarfile.open(tgz) as t:
        three = t.extractfile('package/build/three.min.js').read()
    return [('assets/index.html', html.encode('utf-8'), True), ('assets/three.min.js', three, True)]


# ---------------------------------------------------------------- zip with 4-byte aligned stored entries
def write_apk(path, entries):
    with open(path, 'wb') as f, zipfile.ZipFile(f, 'w') as z:
        for name, data, deflate in entries:
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.external_attr = 0o644 << 16
            if deflate:
                zi.compress_type = zipfile.ZIP_DEFLATED
            else:
                zi.compress_type = zipfile.ZIP_STORED
                pad = -(f.tell() + 30 + len(name.encode()) + 6) % 4
                zi.extra = struct.pack('<HHH', 0xD935, 2 + pad, 4) + b'\x00' * pad   # zipalign-style padding
            z.writestr(zi, data)


def check_alignment(path):
    raw = open(path, 'rb').read()
    with zipfile.ZipFile(path) as z:
        for zi in z.infolist():
            if zi.compress_type != zipfile.ZIP_STORED:
                continue
            n, m = struct.unpack_from('<HH', raw, zi.header_offset + 26)
            if (zi.header_offset + 30 + n + m) % 4:
                sys.exit(f'{zi.filename} is stored but not 4-byte aligned')


def main():
    for tool in ('javac', 'java', 'keytool'):
        if not shutil.which(tool):
            sys.exit(f'{tool} not found; install a JDK (17 or newer)')
    jars = {k: fetch(u, os.path.join(CACHE, k)) for k, u in DEPS.items()}
    shutil.rmtree(BUILD, ignore_errors=True)
    classes, tools = os.path.join(BUILD, 'classes'), os.path.join(BUILD, 'tools')
    os.makedirs(classes); os.makedirs(tools); os.makedirs(DIST, exist_ok=True)

    log('compiling the WebView wrapper')
    src = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(HERE, 'src')) for f in fs if f.endswith('.java')]
    # The Maven stubs carry only android.*; java.* comes from the JDK's Java 8 API.
    run(['javac', '--release', '8', '-Xlint:-options', '-cp', jars['android.jar'], '-d', classes] + src)
    log('dexing')
    dex = os.path.join(BUILD, 'classes.dex')
    run(['java', '-cp', jars['dx.jar'], 'com.android.dx.command.Main', '--dex', f'--min-sdk-version={MIN_SDK}', f'--output={dex}', classes])
    run(['javac', '-cp', jars['apksig.jar'], '-d', tools, os.path.join(HERE, 'tools', 'SignApk.java'), os.path.join(HERE, 'tools', 'VerifyApk.java')])

    if not os.path.exists(KEYSTORE):
        log('creating debug signing key')
        run(['keytool', '-genkeypair', '-keystore', KEYSTORE, '-storepass', STOREPASS, '-alias', ALIAS, '-keypass', KEYPASS,
             '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US'])

    log('packaging')
    icon_path = 'res/drawable-nodpi-v4/icon.png'
    entries = [
        ('AndroidManifest.xml', manifest(), True),
        ('classes.dex', open(dex, 'rb').read(), True),
        ('resources.arsc', resources_arsc(icon_path), False),   # must be stored and aligned for targetSdk 30+
        (icon_path, icon_png(), False),
    ] + game_assets()
    unsigned = os.path.join(BUILD, 'unsigned.apk')
    write_apk(unsigned, entries)
    check_alignment(unsigned)

    log('signing (APK Signature Scheme v2)')
    cp = os.pathsep.join([jars['apksig.jar'], tools])
    # apksig 2.3.0 touches sun.security.x509 while loading, which newer JDKs only allow when exported.
    jvm = ['java'] + [f'--add-exports=java.base/sun.security.{p}=ALL-UNNAMED' for p in ('x509', 'pkcs', 'util')] + ['-cp', cp]
    run(jvm + ['SignApk', unsigned, OUT_APK, KEYSTORE, STOREPASS, ALIAS, KEYPASS, str(MIN_SDK)])
    check_alignment(OUT_APK)
    run(jvm + ['VerifyApk', OUT_APK, str(MIN_SDK), str(TARGET_SDK)])

    digest = hashlib.sha256(open(OUT_APK, 'rb').read()).hexdigest()
    log(f'done: {os.path.relpath(OUT_APK)} ({os.path.getsize(OUT_APK) / 1024:.0f} KB, sha256 {digest[:16]}…)')


if __name__ == '__main__':
    main()
