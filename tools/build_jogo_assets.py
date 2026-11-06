"""Prepara docs/assets para o jogo.

Rodar da raiz: python3 -I tools/build_jogo_assets.py
- Peças do personagem e dos itens: desde a etapa 12 vêm de tools/build_definicoes.py (docs/assets/lpc).
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


# peças do personagem e dos itens: tools/build_definicoes.py (definições do gerador LPC, docs/assets/lpc) desde a etapa 12
if os.path.isdir(OUT + "pecas"):
    shutil.rmtree(OUT + "pecas")
# efeitos de magia do Mago (Extended LPC Magic pack, creditado pelo mostruário)
os.makedirs(OUT + "efeitos", exist_ok=True)
for f in ("firelion_down", "firelion_up", "firelion_left", "firelion_right", "lightningclaw", "spikes", "iceshield", "tornado"):
    shutil.copy(f"assets/raw/extended-lpc-magic-pack/x_magic_pack.zip/magic_pack/sheets/{f}.png", OUT + f"efeitos/{f}.png")
shutil.copy("assets/raw/lpc-forest-tiles/x_LPC_forest_0.zip/LPC_forest/forest_tiles.png", OUT + "forest_tiles.png")
shutil.copy("assets/raw/lpc-cavern-and-ruin-tiles/x_LPC_cavern_ruins.zip/LPC_cavern_ruins/cavern_ruins.png", OUT + "cavern_ruins.png")  # chão e objetos da Caverna e das Ruínas
for f in ("tiles/dirt.png", "tiles/signs.png", "tiles/house.png", "sprites/people/soldier.png",
          "sprites/people/soldier_altcolor.png", "sprites/people/princess.png"):
    shutil.copy(BASE + f, OUT + f.split("/")[-1])
print("assets do jogo prontos em", OUT)
