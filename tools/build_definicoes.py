"""Gera docs/dados/lpc_definicoes.json e baixa as imagens do catálogo de equipamentos (etapa 11).

Rodar da raiz: python3 -I tools/build_definicoes.py

Fonte única: o repositório oficial do gerador LPC (Universal-LPC-Spritesheet-Character-Generator).
- sheet_definitions/<formato>.json: camadas (zPos), animações, variantes, recolors e créditos;
- palette_definitions/: paletas metal, wood, cloth (e meta_* com a cor-base de cada material);
- spritesheets/: as imagens.
Tudo o que é baixado é tratado como dado (só lido com json/PIL), guardado em assets/raw/gerador-defs/ (não versionado).
Item, animação, variante ou arquivo que não existir faz o script parar: nunca inventar.
"""
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image

RAIZ_GERADOR = "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/"
RAW = "assets/raw/gerador-defs/"
OUT_IMG = "docs/assets/lpc/"
ITENS = json.load(open("docs/dados/itens.json", encoding="utf-8"))
APAR = json.load(open("docs/dados/aparencia.json", encoding="utf-8"))
RAR = json.load(open("docs/dados/raridades.json", encoding="utf-8"))
VALDOR = json.load(open("docs/dados/paletas_valdor.json", encoding="utf-8"))["cores"]

# tamanho do quadro de cada animação (sources/state/constants.ts e sources/custom-animations.ts do gerador)
ANIM = {"walk": {"quadros": 9, "tamanho": 64}, "slash": {"quadros": 6, "tamanho": 64},
        "thrust": {"quadros": 8, "tamanho": 64}, "shoot": {"quadros": 13, "tamanho": 64}}
CUSTOM = {"walk_128": ("walk", 128), "slash_128": ("slash", 128), "slash_oversize": ("slash", 192),
          "thrust_128": ("thrust", 128), "thrust_oversize": ("thrust", 192)}
MATERIAIS = ("metal", "wood", "cloth", "body", "hair", "eye")


def baixar(caminho, obrigatorio=True):
    local = RAW + caminho
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        req = urllib.request.Request(RAIZ_GERADOR + caminho, headers={"User-Agent": "valdor/0.1"})
        try:
            dados = urllib.request.urlopen(req, timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code == 404 and not obrigatorio:
                return None
            raise SystemExit(f"não encontrado no gerador: {caminho} ({e.code})")
        open(local, "wb").write(dados)
    return local


def paletas():
    out = {}
    for m in MATERIAIS:
        meta = json.load(open(baixar(f"palette_definitions/{m}/meta_{m}.json"), encoding="utf-8"))
        cores = json.load(open(baixar(f"palette_definitions/{m}/{m}_ulpc.json"), encoding="utf-8"))
        out[m] = {"base": meta["base"], "cores": cores}
    out["valdor"] = {"base": None, "cores": VALDOR}
    return out


def definicao(formato):
    d = json.load(open(baixar(f"sheet_definitions/{formato}.json"), encoding="utf-8"))
    camadas = []
    for k in sorted((k for k in d if k.startswith("layer_")), key=lambda k: int(k[6:])):
        c = d[k]
        if not c.get("male"):
            continue
        custom = c.get("custom_animation")
        anim, tam = CUSTOM.get(custom, (None, 64)) if custom else (None, 64)
        if custom and custom not in CUSTOM:
            continue  # animação especial que o jogo não usa
        camadas.append({"z": c["zPos"], "pasta": c["male"], "custom": custom, "anim": anim, "tamanho": tam})
    rec = d.get("recolors")
    if isinstance(rec, dict) and "material" in rec:
        rec = [rec]
    elif isinstance(rec, dict):
        rec = [rec[k] for k in sorted(rec) if k.startswith("color_")]
    else:
        rec = []
    return {"nome": d.get("name"), "animacoes": d.get("animations"), "variantes": d.get("variants") or [],
            "recolors": [{"material": r.get("material"), "base": r.get("base")} for r in rec],
            "camadas": camadas, "creditos": d.get("credits", [])}


def arquivo(cam, anim, variante):
    if cam["custom"]:
        return cam["pasta"] + variante.replace(" ", "_") + ".png" if variante else cam["pasta"].rstrip("/") + ".png"
    return cam["pasta"] + anim + ("/" + variante.replace(" ", "_") if variante else "") + ".png"  # "kite gray" -> kite_gray.png


def existe(caminho):
    return baixar("spritesheets/" + caminho, obrigatorio=False) is not None


def camadas_da_animacao(d, anim, variante):
    """custom (walk_128, *_oversize) tem prioridade, como no gerador; depois as camadas normais"""
    # só animações que a definição declara (se ela declara alguma): a pasta pode ter imagens que o gerador não usa
    decl = d["animacoes"]
    custom = [i for i, c in enumerate(d["camadas"]) if c["anim"] == anim and (decl is None or c["custom"] in decl)]
    normais = [i for i, c in enumerate(d["camadas"]) if not c["custom"]] if decl is None or anim in decl else []
    # como o gerador: camada da definição sem imagem é pulada (ex.: o arco grande não tem a parte de trás ao atirar)
    for grupo in (custom, normais):
        achadas = [i for i in grupo if existe(arquivo(d["camadas"][i], anim, variante))]
        if achadas:
            return achadas
    return None


def cobertura(caminho, cores):
    hx = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in cores]
    im = Image.open(RAW + "spritesheets/" + caminho).convert("RGBA")
    px = [p for p in im.get_flattened_data() if p[3]] if hasattr(im, "get_flattened_data") else [p for p in im.getdata() if p[3]]
    ok = sum(1 for p in px if any(all(abs(p[i] - q[i]) <= 1 for i in range(3)) for q in hx))
    return ok / max(1, len(px))


def main():
    P = paletas()
    defs, usados = {}, set()
    # base de cada classe; "@rosto", "@cabelo", "@barba" valem para todas as opções da tela de Aparência
    partes = []
    for c, ps in ITENS["base_personagem"].items():
        for p in ps:
            if p["def"].startswith("@"):
                for o in APAR[p["def"][1:]]:
                    if o.get("def"):
                        partes.append((None, {**p, "def": o["def"]}, [c]))
            else:
                partes.append((None, p, [c]))
    partes += [(it, p, it["classes"]) for it in ITENS["itens"] if it.get("formato") for p in it["formato"]]
    for it, parte, classes in partes:
        f = parte["def"]
        if f not in defs:
            defs[f] = definicao(f)
            defs[f]["por_animacao"] = {}
        d = defs[f]
        anims = parte.get("so_animacoes") or sorted({a for c in classes for a in ITENS["animacoes_classe"][c]})
        # variantes necessárias: a pedida, as cores de raridade que existem prontas, e a base para trocar paleta
        precisa = set()
        cor = parte["cor"]
        if cor == "base":
            pass  # a imagem como o gerador fez, sem troca de cor
        elif cor.startswith("variante."):
            precisa.add(cor[9:])
        elif not d["recolors"] and d["variantes"]:
            cores = [r["cores"][parte["material"]] for r in RAR["raridades"].values()] if cor == "raridade" else [cor]
            for c in cores:
                nome = c.split(".", 1)[1]
                precisa.add(nome if nome in d["variantes"] else parte["base_variante"])
        if not precisa:
            precisa = {None}
        for anim in anims:
            for v in sorted(precisa, key=str):
                grupo = camadas_da_animacao(d, anim, v)
                if grupo is None:
                    if anim == "thrust" and any(c in ITENS["estocada_pode_usar_golpe"] for c in classes):
                        d["por_animacao"]["thrust"] = "slash"  # improviso já aprovado: a Estocada usa o golpe
                        continue
                    raise SystemExit(f"{f}: sem a animação {anim} (variante {v})")
                if d["por_animacao"].get(anim) not in (None, grupo):
                    raise SystemExit(f"{f}: camadas de {anim} mudam com a variante {v}")
                d["por_animacao"][anim] = grupo
                for i in grupo:
                    usados.add(arquivo(d["camadas"][i], anim, v))
        # troca de cor a partir da imagem base de itens só com variantes: confere que a base usa a paleta-base
        if "base_variante" in parte and not d["recolors"]:
            m = parte["material"]
            if d.get("base_variante", parte["base_variante"]) != parte["base_variante"]:
                raise SystemExit(f"{f}: dois itens pedem bases diferentes")
            amostra = arquivo(d["camadas"][d["por_animacao"]["walk"][-1]], "walk", parte["base_variante"])
            # a base pode ter sido pintada em qualquer cor do material: fica com a que cobre mais pixels
            cob, nome = max((cobertura(amostra, cores), nome) for nome, cores in P[m]["cores"].items())
            d["base_variante"] = parte["base_variante"]
            d["paleta_base"] = f"{m}.{nome}" if cob >= 0.6 else None
            d["cobertura_base"] = round(cob, 2)
    # copia as imagens usadas
    for c in sorted(usados):
        os.makedirs(os.path.dirname(OUT_IMG + c), exist_ok=True)
        with open(RAW + "spritesheets/" + c, "rb") as a, open(OUT_IMG + c, "wb") as b:
            b.write(a.read())
    saida = {"_sobre": "gerado por tools/build_definicoes.py a partir do repositório oficial do gerador LPC; não editar à mão",
             "fonte": RAIZ_GERADOR, "animacoes": ANIM, "paletas": P, "definicoes": defs, "arquivos": sorted(usados)}
    json.dump(saida, open("docs/dados/lpc_definicoes.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # créditos para o CREDITOS.md (lidos por tools/build_mostruario.py)
    linhas = []
    for f in sorted(defs):
        for c in defs[f]["creditos"]:
            linhas.append(f"- `{f}` ({c['file']}): {', '.join(c['authors'])} | {', '.join(c['licenses'])} | {', '.join(c['urls'])}"
                          + (f" | {c['notes']}" if c.get("notes") else ""))
        if not defs[f]["creditos"]:
            raise SystemExit(f"{f}: definição sem créditos")
    open("data/creditos_catalogo.md", "w", encoding="utf-8").write("\n".join(linhas) + "\n")
    print(len(defs), "definições,", len(usados), "imagens em", OUT_IMG, file=sys.stderr)
    for f, d in defs.items():
        if "cobertura_base" in d:
            print(f"  {f}: base '{d['base_variante']}' na paleta {d['paleta_base']} ({d['cobertura_base']:.0%})", file=sys.stderr)


if __name__ == "__main__":
    main()
