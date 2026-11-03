"""Monta as construções da cidade a partir das peças LPC (tudo creditado em CREDITOS.md) em docs/assets/cidade/.

Rodar da raiz: python3 -I tools/build_cidade.py
Cada construção é uma imagem só, desenhada no mapa como um objeto que bloqueia a passagem.
"""
import os

from PIL import Image

R = "assets/raw/"
BASE = R + "liberated-pixel-cup-lpc-base-assets-sprites-map-tiles/x_lpc_base_assets.zip/LPC Base Assets/tiles/"
OUT = "docs/assets/cidade/"
os.makedirs(OUT, exist_ok=True)


def abrir(p):
    return Image.open(p).convert("RGBA")


def colar(dest, img, caixa, pos):
    dest.alpha_composite(img.crop(caixa), pos)


def poste(im, x, y0, y1):
    """poste de madeira de 4 px (desenhado aqui) para placas e quadro"""
    for y in range(y0, y1):
        for dx in range(4):
            im.putpixel((x + dx, y), (92, 58, 34, 255) if dx in (1, 2) else (60, 38, 22, 255))


casa = abrir(BASE + "house.png")
# casa: telhado de ardósia (96x128) sobre a fachada (96x96) com porta; a empena do telhado (vão no meio)
# mostra a parede de trás com uma janela de sótão
for nome, parede in (("casa_tijolo", (0, 0, 96, 96)), ("casa_pedra", (96, 128, 192, 224))):
    im = Image.new("RGBA", (96, 224))
    colar(im, casa, (parede[0] + 24, parede[1] + 24, parede[0] + 72, parede[1] + 72), (24, 80))  # parede da empena
    colar(im, casa, (256, 8, 288, 56), (32, 86))    # janela do sótão
    colar(im, casa, (0, 96, 96, 224), (0, 0))       # telhado
    colar(im, casa, parede, (0, 128))               # fachada
    colar(im, casa, (96, 0, 128, 64), (32, 160))    # porta
    im.save(OUT + nome + ".png")

# forja: fornalha acesa com chaminé, bigorna, banco de ferramentas e suporte de armas; placa da espada
bs = abrir(R + "lpc-blacksmith/x_lpc-blacksmith.zip/lpc-blacksmith/blacksmith-smelter.png")
placas = abrir(R + "lpc-hanging-signs/lpc-hanging-signs_0.png")
im = Image.new("RGBA", (160, 128))
colar(im, bs, (64, 0, 128, 128), (0, 0))           # fornalha acesa
colar(im, bs, (256, 480, 320, 544), (60, 64))      # banco com ferramentas
colar(im, bs, (384, 480, 448, 544), (96, 40))      # suporte de armas
colar(im, bs, (256, 416, 288, 448), (70, 104))     # bigorna
poste(im, 150, 2, 128)
colar(im, placas, (0, 0, 32, 32), (124, 6))        # placa da espada
im.save(OUT + "forja.png")

# barraca do mercador: toldo listrado com poções; placa da bolsa
bz = abrir(R + "lpc-bazaar-rework/x_lpc_bazaar_rework-1.0-1.zip/preview.png")
im = Image.new("RGBA", (96, 96))
colar(im, bz, (0, 0, 64, 96), (0, 0))
poste(im, 88, 6, 96)
colar(im, placas, (96, 0, 128, 32), (62, 10))      # placa da bolsa
im.save(OUT + "barraca.png")

# quadro de missões: quadro de avisos com papéis, sobre dois pés de madeira (desenhados aqui)
qb = abrir(R + "bulletin-board-and-items/bulletin_board_0.png")
pap = abrir(R + "bulletin-board-and-items/bulletin_board_items.png")
im = Image.new("RGBA", (96, 96))
for x in (12, 80):  # pés
    poste(im, x, 56, 96)
colar(im, qb, (0, 0, 96, 64), (0, 0))
for (cx, cy), (px, py) in (((0, 32), (6, 6)), ((32, 0), (34, 4)), ((160, 0), (62, 10)), ((128, 64), (36, 30)), ((0, 96), (8, 32))):
    colar(im, pap, (cx, cy, cx + 32, cy + 32), (px, py))
im.save(OUT + "quadro.png")

# fonte da praça e poço
colar(im := Image.new("RGBA", (64, 96)), abrir(R + "lpc-water-fountain/WaterFountain.png"), (0, 0, 64, 96), (0, 0))
im.save(OUT + "fonte.png")
im = Image.new("RGBA", (64, 64))
colar(im, abrir(R + "lpc-style-well/lpc-well.png"), (0, 0, 64, 64), (0, 0))
im.save(OUT + "poco.png")
print("construções da cidade em", OUT)
