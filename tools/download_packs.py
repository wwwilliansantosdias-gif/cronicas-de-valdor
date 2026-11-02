"""Baixa os arquivos de data/meta.json para assets/raw/<slug>/ e extrai zips sem executar nada."""
import json
import os
import urllib.request
import zipfile

meta = json.load(open("data/meta.json"))
for slug, m in meta.items():
    for f in m.get("arquivos", []):
        d = os.path.join("assets/raw", slug)
        os.makedirs(d, exist_ok=True)
        name = os.path.basename(f["url"].split("?")[0])
        dest = os.path.join(d, name)
        if not os.path.exists(dest):
            req = urllib.request.Request(f["url"], headers={"User-Agent": "valdor-mostruario/0.1"})
            open(dest, "wb").write(urllib.request.urlopen(req, timeout=120).read())
        if name.lower().endswith(".zip"):
            with zipfile.ZipFile(dest) as z:
                base = os.path.realpath(os.path.join(d, "x_" + name))
                for i in z.infolist():
                    t = os.path.realpath(os.path.join(base, i.filename))
                    if not t.startswith(base + os.sep) and t != base:
                        continue
                    z.extract(i, base)
        print(slug, name)
