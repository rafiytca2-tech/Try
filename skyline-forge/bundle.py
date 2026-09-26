#!/usr/bin/env python3
"""Inline Skyline Forge's js/ files into one self-contained HTML page.

index.html loads the game as separate classic scripts that share one global scope, so it runs
as-is from a web server or file://. Concatenating them in load order gives the same program in
a single file, which is what the Android APK and the hosted web version ship.

    python3 skyline-forge/bundle.py            # -> skyline-forge/dist/skyline-forge.html
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT_TAG = re.compile(r'<script src="(js/[\w.-]+\.js)"></script>\n')


def bundle(html_path=os.path.join(HERE, 'index.html')):
    html = open(html_path, encoding='utf-8').read()
    names = SCRIPT_TAG.findall(html)
    if not names:
        sys.exit('no js/ script tags found in index.html')
    parts = []
    for name in names:
        src = open(os.path.join(os.path.dirname(html_path), name), encoding='utf-8').read()
        if '</script' in src:
            sys.exit(f'{name} contains "</script", which would end the inline script early')
        parts.append(f'/* ---- {name} ---- */\n{src}')
    joined = '<script>\n' + '\n'.join(parts) + '</script>\n'
    first = True

    def replace(_m):
        nonlocal first
        if first:
            first = False
            return joined
        return ''
    return SCRIPT_TAG.sub(replace, html)


if __name__ == '__main__':
    out = os.path.join(HERE, 'dist', 'skyline-forge.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    data = bundle()
    open(out, 'w', encoding='utf-8').write(data)
    print(f'wrote {os.path.relpath(out)} ({len(data) / 1024:.0f} KB)')
