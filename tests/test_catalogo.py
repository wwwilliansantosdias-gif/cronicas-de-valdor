"""Catálogo de equipamentos (etapa 11): toda peça vem das definições do gerador LPC, toda imagem existe e está creditada."""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ler = lambda f: json.load(open(os.path.join(RAIZ, "docs", "dados", f), encoding="utf-8"))
CAT, DEFS, RAR, VAL = ler("catalogo_equipamentos.json"), ler("lpc_definicoes.json"), ler("raridades.json"), ler("paletas_valdor.json")
CRED = open(os.path.join(RAIZ, "CREDITOS.md"), encoding="utf-8").read()


def test_todo_formato_existe_nas_definicoes_e_esta_creditado():
    formatos = {p["def"] for it in CAT["itens"] for p in it["formato"]} | {p["def"] for ps in CAT["base_personagem"].values() for p in ps}
    for f in formatos:
        assert f in DEFS["definicoes"], f
        assert f"`{f}`" in CRED, f"{f} sem crédito em CREDITOS.md"


def test_toda_imagem_usada_existe():
    for a in DEFS["arquivos"]:
        assert os.path.exists(os.path.join(RAIZ, "docs", "assets", "lpc", a)), a


def test_cores_existem_nas_paletas():
    pal = DEFS["paletas"]
    for r in RAR["raridades"].values():
        for cor in r["cores"].values():
            m, nome = cor.split(".")
            assert nome in pal[m]["cores"], cor
    for it in CAT["itens"]:
        for p in it["formato"]:
            if p["cor"] not in ("raridade",) and not p["cor"].startswith("variante."):
                m, nome = p["cor"].split(".")
                assert nome in pal[m]["cores"], (it["id"], p["cor"])
            if p["cor"].startswith("variante."):
                assert p["cor"][9:] in DEFS["definicoes"][p["def"]]["variantes"], (it["id"], p["cor"])
    for nome, cores in VAL["cores"].items():
        assert len(cores) == 6, nome  # mesma quantidade de tons das paletas do gerador


def test_raridade_por_material_so_em_metal_e_madeira():
    for it in CAT["itens"]:
        for p in it["formato"]:
            if p["cor"] == "raridade":
                d = DEFS["definicoes"][p["def"]]
                m = p.get("material") or d["recolors"][0]["material"]
                assert m in ("metal", "wood"), (it["id"], m)
