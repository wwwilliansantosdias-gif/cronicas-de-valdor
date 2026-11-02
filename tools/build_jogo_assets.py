"""Prepara docs/assets para o jogo: compoe o Guerreiro em camadas e copia tiles e NPCs.

Rodar da raiz: python3 -I tools/build_jogo_assets.py
As pecas do gerador estao em assets/raw/gerador (caminho logico do CSV; a espada tem
arquivos por variante: walk/longsword.png, attack_slash/longsword.png = slash_oversize
e attack_thrust/longsword.png = thrust_oversize).
"""
import shutil

from PIL import Image

G = "assets/raw/gerador/"
BASE = "assets/raw/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles/x_lpc_base_assets.zip/LPC Base Assets/"
OUT = "docs/assets/"


def empilhar(arquivos, destino):
    im = None
    for f in arquivos:
        camada = Image.open(f).convert("RGBA")
        im = camada if im is None else Image.alpha_composite(im, camada)
    im.save(OUT + destino, optimize=True)


corpo = ["body/bodies/male", "legs/armour/plate/male", "torso/armour/plate/male", "head/heads/human/male", "hat/helmet/armet_simple/adult"]
empilhar([G + c + "/walk.png" for c in corpo] + [G + "weapon/sword/longsword/walk/longsword.png"], "guerreiro_walk.png")
empilhar([G + c + "/slash.png" for c in corpo], "guerreiro_slash.png")
shutil.copy(G + "weapon/sword/longsword/slash_oversize/longsword.png", OUT + "guerreiro_slash_arma.png")
empilhar([G + c + "/thrust.png" for c in corpo], "guerreiro_thrust.png")
shutil.copy(G + "weapon/sword/longsword/thrust_oversize/longsword.png", OUT + "guerreiro_thrust_arma.png")

shutil.copy("assets/raw/lpc-forest-tiles/x_LPC_forest_0.zip/LPC_forest/forest_tiles.png", OUT + "forest_tiles.png")
for f in ("tiles/dirt.png", "tiles/signs.png", "tiles/house.png", "sprites/people/soldier.png",
          "sprites/people/soldier_altcolor.png", "sprites/people/princess.png"):
    shutil.copy(BASE + f, OUT + f.split("/")[-1])
print("assets do jogo prontos em", OUT)
