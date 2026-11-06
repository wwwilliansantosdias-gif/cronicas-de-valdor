"""Catálogo de equipamentos (etapa 11): toda peça vem das definições do gerador LPC, toda imagem existe e está creditada."""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ler = lambda f: json.load(open(os.path.join(RAIZ, "docs", "dados", f), encoding="utf-8"))
CAT, DEFS, RAR, VAL, APAR = ler("itens.json"), ler("lpc_definicoes.json"), ler("raridades.json"), ler("paletas_valdor.json"), ler("aparencia.json")
VESTIVEIS = [it for it in CAT["itens"] if it.get("tipo") != "consumivel"]
CRED = open(os.path.join(RAIZ, "CREDITOS.md"), encoding="utf-8").read()


def test_todo_formato_existe_nas_definicoes_e_esta_creditado():
    formatos = {p["def"] for it in VESTIVEIS for p in it["formato"]} | {p["def"] for ps in CAT["base_personagem"].values() for p in ps if not p["def"].startswith("@")}
    formatos |= {o["def"] for c in ("rosto", "cabelo", "barba") for o in APAR[c] if o.get("def")}
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
    for it in VESTIVEIS:
        for p in it["formato"]:
            if p["cor"] not in ("raridade", "base") and not p["cor"].startswith("variante."):
                m, nome = p["cor"].split(".")
                assert nome in pal[m]["cores"], (it["id"], p["cor"])
            if p["cor"].startswith("variante."):
                assert p["cor"][9:] in DEFS["definicoes"][p["def"]]["variantes"], (it["id"], p["cor"])
    for nome, cores in VAL["cores"].items():
        assert len(cores) == 6, nome  # mesma quantidade de tons das paletas do gerador


def test_raridade_por_material_so_em_metal_e_madeira():
    for it in VESTIVEIS:
        for p in it["formato"]:
            if p["cor"] == "raridade":
                d = DEFS["definicoes"][p["def"]]
                m = p.get("material") or d["recolors"][0]["material"]
                assert m in ("metal", "wood"), (it["id"], m)


def test_qualidades_do_jogo_sao_as_raridades_aprovadas():
    assert [q["id"] for q in CAT["qualidades"]] == RAR["ordem"]
    assert [q["nome"] for q in CAT["qualidades"]] == [RAR["raridades"][r]["nome"] for r in RAR["ordem"]]
    mult = [q["mult"] for q in CAT["qualidades"]]
    assert mult == sorted(mult) and mult[0] == 1
    assert abs(sum(q["peso"] for q in CAT["qualidades"][2:]) - 8) < 1e-9  # Raro ou melhor: 8%, como antes


def test_forja_ate_mais_12_mais_dificil_e_mais_cara_a_cada_nivel():
    m = CAT["melhoria"]
    assert m["max"] == RAR["reforco"]["max"] == 12
    assert len(m["chance"]) == len(m["custo_ouro"]) == len(m["fragmentos"]) == 12
    assert all(a >= b for a, b in zip(m["chance"], m["chance"][1:])) and m["chance"][-1] > 0
    assert all(a < b for a, b in zip(m["custo_ouro"], m["custo_ouro"][1:]))


def test_onze_encaixes_e_itens_dos_novos():
    assert len(CAT["espacos"]) == 11 and set(CAT["espacos"]) == set(CAT["encaixes"])
    for e in ("sobre_peito", "pescoco"):
        assert any(it.get("espaco") == e for it in VESTIVEIS), e
