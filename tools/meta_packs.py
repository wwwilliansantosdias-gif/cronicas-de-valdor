"""Le a pagina de cada pacote no OpenGameArt e grava data/meta.json (autor, licencas, arquivos)."""
import html
import json
import re
import sys
import urllib.request

BASE = "https://opengameart.org/content/"


def fetch(slug):
    req = urllib.request.Request(BASE + slug, headers={"User-Agent": "valdor-mostruario/0.1"})
    try:
        return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return "ERRO:" + str(e)


def parse(slug, t):
    if t.startswith("ERRO:"):
        return {"slug": slug, "erro": t}
    title = html.unescape(re.search(r"<title>(.*?) \|", t).group(1))
    lic_block = re.search(r"field-name-field-art-licenses.*?(?=field-name-)", t, re.S)
    licencas = re.findall(r"license-name'>(.*?)</div>", lic_block.group(0)) if lic_block else []
    autor = re.search(r"class='username'><a href=\"/users/([^\"]+)\"", t)
    files = re.findall(r'<a href="(https://opengameart\.org/sites/default/files/[^"]+)" type="[^"]*; length=(\d+)"', t)
    att = re.search(r'field-name-field-copyright-notice.*?<div class="field-item even">(.*?)</div></div></div>', t, re.S)
    atribuicao = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", att.group(1)))).strip() if att else None
    return {
        "atribuicao": atribuicao,
        "slug": slug, "titulo": title, "url": BASE + slug,
        "autor": autor.group(1) if autor else None,
        "licencas": licencas,
        "arquivos": [{"url": u, "bytes": int(n)} for u, n in files],
    }


if __name__ == "__main__":
    packs = json.load(open("data/packs.json"))
    slugs = sorted({s for g in packs.values() for v in g.values() for s in v})
    out = {}
    for s in slugs:
        out[s] = parse(s, fetch(s))
        print(s, out[s].get("erro") or (out[s]["autor"], out[s]["licencas"], sum(f["bytes"] for f in out[s]["arquivos"])), file=sys.stderr)
    json.dump(out, open("data/meta.json", "w"), indent=1, ensure_ascii=False)
