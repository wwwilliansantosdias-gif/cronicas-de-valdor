"""Prepara docs/assets para o jogo.

Rodar da raiz: python3 -I tools/build_jogo_assets.py
- Peças do personagem (corpo, cabeça e o visual de cada item de docs/dados/itens.json) são baixadas do
  gerador LPC para assets/raw/gerador/ (não versionado) e copiadas para docs/assets/pecas/; o jogo
  empilha as camadas na hora, então trocar um item troca a aparência.
- data/pecas_usadas.txt é gerado daqui (corpo + "peca_lpc" de cada item), para os créditos nunca ficarem para trás.
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
ANIMS = ("walk", "slash", "thrust")


def baixar(caminho):
    local = RAW + caminho
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        req = urllib.request.Request(GERADOR + caminho, headers={"User-Agent": "valdor/0.1"})
        open(local, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    destino = OUT + "pecas/" + caminho
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.copy(local, destino)


itens = json.load(open("docs/dados/itens.json", encoding="utf-8"))
usadas = ["# gerado por tools/build_jogo_assets.py: corpo do personagem + peca_lpc de cada item de docs/dados/itens.json"]
if os.path.isdir(OUT + "pecas"):
    shutil.rmtree(OUT + "pecas")
for classe, c in itens["corpo"].items():
    if not isinstance(c, dict):
        continue
    for pasta in (c["base"], c["cabeca"]):
        for a in ANIMS:
            baixar(f"{pasta}/{a}.png")
            usadas.append(f"{pasta}/{a}.png")
for it in itens["itens"]:
    for caminho in (it.get("visual") or {}).values():
        if isinstance(caminho, str):
            baixar(caminho)
    usadas += [p for p in it.get("peca_lpc", []) if p not in usadas]
open("data/pecas_usadas.txt", "w", encoding="utf-8").write("\n".join(usadas) + "\n")

for velho in ("guerreiro_walk", "guerreiro_slash", "guerreiro_slash_arma", "guerreiro_thrust", "guerreiro_thrust_arma"):
    if os.path.exists(f"{OUT}{velho}.png"):
        os.remove(f"{OUT}{velho}.png")
shutil.copy("assets/raw/lpc-forest-tiles/x_LPC_forest_0.zip/LPC_forest/forest_tiles.png", OUT + "forest_tiles.png")
for f in ("tiles/dirt.png", "tiles/signs.png", "tiles/house.png", "sprites/people/soldier.png",
          "sprites/people/soldier_altcolor.png", "sprites/people/princess.png"):
    shutil.copy(BASE + f, OUT + f.split("/")[-1])
print("assets do jogo prontos em", OUT, "·", len(usadas) - 1, "peças do gerador")
