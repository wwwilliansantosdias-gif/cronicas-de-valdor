"""Gera docs/ (mostruario) e CREDITOS.md a partir de data/mostruario.json e data/meta.json.

Rodar da raiz do repositorio: python3 -I tools/build_mostruario.py
Le assets/raw (nao versionado), copia so as imagens usadas para docs/img.
"""
import hashlib
import json
import os
import re

from PIL import Image

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import creditos_pecas  # noqa: E402

RAW = "assets/raw"
OUT = "docs/mostruario"
spec = json.load(open("data/mostruario.json"))
meta = json.load(open("data/meta.json"))
copied = {}


def dest_name(key, ext=".png"):
    base = re.sub(r"[^A-Za-z0-9]+", "_", os.path.splitext(os.path.basename(key.split("|")[0]))[0]).strip("_")
    return f"img/{base}_{hashlib.sha1(key.encode()).hexdigest()[:6]}{ext}"


def publish(file, layers=None, chroma=None):
    key = "|".join([file] + (layers or []) + [chroma or ""])
    if key in copied:
        return copied[key]
    name = dest_name(key)
    if layers:
        im = None
        for lp in layers:
            layer = Image.open(os.path.join(RAW, lp)).convert("RGBA")
            im = layer if im is None else Image.alpha_composite(im, layer)
    else:
        im = Image.open(os.path.join(RAW, file)).convert("RGBA")
    if chroma:
        r, g, b = (int(chroma[i:i + 2], 16) for i in (1, 3, 5))
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][:3] == (r, g, b):
                    px[x, y] = (0, 0, 0, 0)
    im.save(os.path.join(OUT, name), optimize=True)
    copied[key] = name
    return name


def anim(a, chroma=None):
    if not a:
        return None
    b = dict(a)
    b["file"] = publish(a["file"], a.get("layers"), chroma)
    b.pop("layers", None)
    return b


out = {"monstros": [], "cenarios": [], "sem_pacote": spec["sem_pacote"]}
slugs = set()
for m in spec["monstros"]:
    slugs.update(m["pacotes"])
    o = dict(m)
    for k in ("andar", "ataque", "morte"):
        o[k] = anim(m[k], m["chroma"])
    o["folha"] = publish(m["folha"], None, m["chroma"]) if m["folha"] else None
    out["monstros"].append(o)
for c in spec["cenarios"]:
    slugs.update(c["pacotes"])
    o = dict(c)
    o["imagens"] = [{"nome": i["nome"], "file": publish(i["file"])} for i in c["imagens"]]
    out["cenarios"].append(o)
for s in out["monstros"] + out["cenarios"]:
    s["pacotes_info"] = [
        {"slug": p, "titulo": meta[p].get("titulo", p), "url": meta[p].get("url"),
         "licencas": meta[p].get("licencas", [])} for p in s["pacotes"]
    ]
json.dump(out, open(os.path.join(OUT, "mostruario.json"), "w"), ensure_ascii=False, indent=1)


def credit_files(slug):
    found = {}
    for d, _, fs in os.walk(os.path.join(RAW, slug)):
        if "__MACOSX" in d:
            continue
        for f in fs:
            if re.search(r"(credit|attrib|read ?me)", f, re.I) and f.lower().endswith(".txt"):
                txt = open(os.path.join(d, f), encoding="utf-8", errors="replace").read().strip()
                found.setdefault(txt, f)
    return found


lines = [
    "# Créditos", "",
    "Gerado por `tools/build_mostruario.py` a partir das páginas do OpenGameArt e dos arquivos de crédito que vêm dentro de cada pacote.",
    "Cada imagem usada no jogo ou no mostruário precisa ter o pacote de origem listado aqui.", "",
    "Licenças: CC-BY e CC-BY-SA exigem dar crédito aos autores; CC-BY-SA e GPL exigem que material derivado siga as mesmas regras. Onde há várias licenças, vale escolher uma delas, desde que cumprida.", "",
]
for slug in sorted(slugs):
    m = meta.get(slug, {})
    lines += [f"## {m.get('titulo', slug)}", ""]
    if m.get("erro"):
        lines += [f"- Página não encontrada: {m['erro']}", ""]
        continue
    lines += [f"- Página: {m['url']}", f"- Autor na página: {m.get('autor') or '(vários / não informado)'}",
              f"- Licenças: {', '.join(m.get('licencas', [])) or '(não informadas)'}"]
    lines += [f"- Aviso de atribuição da página: {m['atribuicao']}" if m.get("atribuicao")
              else "- **A página não traz texto de atribuição.** Conferir o arquivo de créditos abaixo, se houver."]
    cf = credit_files(slug)
    for txt, fname in cf.items():
        lines += ["", f"Arquivo `{fname}` do pacote:", "", "```text", txt, "```"]
    if not cf:
        lines += ["- O pacote não traz arquivo de créditos próprio."]
    lines.append("")
lines += [
    "## Gerador de personagens LPC (Universal LPC Spritesheet Character Generator)", "",
    "- Projeto: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator",
    "- Fonte dos créditos: `data/gerador/CREDITS.csv` (autor, licença e URL de cada peça, baixado do projeto).",
    "- Peças usadas no jogo (listadas em `data/pecas_usadas.txt`; para incluir outra, acrescente o caminho lá e rode este script):", "",
]
lines += creditos_pecas.linhas("data/pecas_usadas.txt")
lines.append("")
open("CREDITOS.md", "w", encoding="utf-8").write("\n".join(lines))
open(os.path.join(OUT, "CREDITOS.md"), "w", encoding="utf-8").write("\n".join(lines))
open("docs/CREDITOS.md", "w", encoding="utf-8").write("\n".join(lines))
print(len(copied), "imagens copiadas;", len(slugs), "pacotes nos créditos")
