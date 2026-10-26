#!/usr/bin/env python3
"""zip-app.py <src-dir-containing-app> <App.app> <out.zip>: zip a macOS .app keeping symlinks and unix modes (like `ditto -c -k`)."""
import os, stat, sys, zipfile
root, app, out = sys.argv[1:4]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dp, dns, fns in os.walk(os.path.join(root, app), followlinks=False):
        rel = os.path.relpath(dp, root)
        names = [(d, True) for d in dns] + [(f, False) for f in fns]
        zi = zipfile.ZipInfo(rel + '/'); zi.external_attr = (stat.S_IFDIR | 0o755) << 16 | 0x10; z.writestr(zi, b'')
        for n, isdir in names:
            p = os.path.join(dp, n); arc = os.path.join(rel, n)
            st = os.lstat(p)
            if stat.S_ISLNK(st.st_mode):
                zi = zipfile.ZipInfo(arc); zi.create_system = 3; zi.external_attr = (stat.S_IFLNK | 0o777) << 16
                z.writestr(zi, os.readlink(p))
                if isdir: dns.remove(n)  # do not descend into linked dirs
            elif not isdir:
                zi = zipfile.ZipInfo.from_file(p, arc); zi.create_system = 3; zi.external_attr = (stat.S_IFREG | stat.S_IMODE(st.st_mode)) << 16
                zi.compress_type = zipfile.ZIP_DEFLATED
                with open(p, 'rb') as f: z.writestr(zi, f.read(), compresslevel=9)
print(out, os.path.getsize(out))
