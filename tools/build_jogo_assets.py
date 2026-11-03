"""Prepara docs/assets para o jogo.

Rodar da raiz: python3 -I tools/build_jogo_assets.py
- Peças dos personagens (corpo, cabeça e extras de cada classe, e o visual de cada item de
  docs/dados/itens.json) são baixadas do gerador LPC para assets/raw/gerador/ (não versionado) e copiadas
  para docs/assets/pecas/; o jogo empilha as camadas na hora, então trocar um item troca a aparência.
- data/pecas_usadas.txt é gerado daqui (corpo, extras, aparência e "peca_lpc" de cada item), para os créditos nunca
  ficarem para trás.
- Tiles e NPCs vêm do pacote base e da floresta.
"""
import json
import os
import shutil
import urllib.request

GERADOR = "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/"
RAW = "assets/raw/gerador/"
BASE = "assets/raw/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles/x_lpc_base_assets.zip/LPC Base Assets/"
OUT = "docs/assets/"


def baixar(caminho):
    local = RAW + caminho
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        req = urllib.request.Request(GERADOR + caminho, headers={"User-Agent": "valdor/0.1"})
        open(local, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    destino = OUT + "pecas/" + caminho
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.copy(local, destino)


def arquivos(visual):
    """caminhos reais de um "visual": string, {arquivo, coluna} ou a camada "fundo" com o mesmo formato"""
    for k, v in (visual or {}).items():
        if k == "grande" or k == "peca_lpc":
            continue
        if isinstance(v, str):
            yield v
        elif isinstance(v, dict) and "arquivo" in v:
            yield v["arquivo"]
        elif isinstance(v, dict):
            yield from arquivos(v)


itens = json.load(open("docs/dados/itens.json", encoding="utf-8"))
usadas = ["# gerado por tools/build_jogo_assets.py: corpo e extras das classes + peca_lpc de cada item de docs/dados/itens.json"]
if os.path.isdir(OUT + "pecas"):
    shutil.rmtree(OUT + "pecas")
for classe, c in itens["corpo"].items():
    for pasta in (c["base"], c["cabeca"]):
        for a in c["animacoes"]:
            baixar(f"{pasta}/{a}.png")
            if f"{pasta}/{a}.png" not in usadas:
                usadas.append(f"{pasta}/{a}.png")
    for extra in c.get("extras", {}).values():
        for caminho in arquivos(extra):
            baixar(caminho)
        usadas += [p for p in extra["peca_lpc"] if p not in usadas]
# aparência do herói (rosto, cabelo, barba): as mesmas animações das classes
apar = json.load(open("docs/dados/aparencia.json", encoding="utf-8"))
anims = sorted({a for c in itens["corpo"].values() for a in c["animacoes"]})
for op in apar["rosto"] + apar["cabelo"] + apar["barba"]:
    if op["pasta"]:
        for a in anims:
            baixar(f"{op['pasta']}/{a}.png")
            if f"{op['pasta']}/{a}.png" not in usadas:
                usadas.append(f"{op['pasta']}/{a}.png")
for it in itens["itens"]:
    for caminho in arquivos(it.get("visual")):
        baixar(caminho)
    usadas += [p for p in it.get("peca_lpc", []) if p not in usadas]
open("data/pecas_usadas.txt", "w", encoding="utf-8").write("\n".join(usadas) + "\n")

shutil.copy("assets/raw/lpc-forest-tiles/x_LPC_forest_0.zip/LPC_forest/forest_tiles.png", OUT + "forest_tiles.png")
shutil.copy("assets/raw/lpc-cavern-and-ruin-tiles/x_LPC_cavern_ruins.zip/LPC_cavern_ruins/cavern_ruins.png", OUT + "cavern_ruins.png")  # chão e objetos da Caverna e das Ruínas
for f in ("tiles/dirt.png", "tiles/signs.png", "tiles/house.png", "sprites/people/soldier.png",
          "sprites/people/soldier_altcolor.png", "sprites/people/princess.png"):
    shutil.copy(BASE + f, OUT + f.split("/")[-1])
print("assets do jogo prontos em", OUT, "·", len(usadas) - 1, "peças do gerador")
