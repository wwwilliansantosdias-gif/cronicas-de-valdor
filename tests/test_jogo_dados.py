"""Testes dos dados do jogo (docs/dados): itens, monstros, regioes e creditos."""
import csv
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def j(*p):
    return json.load(open(os.path.join(RAIZ, "docs", *p), encoding="utf-8"))


ITENS = j("dados", "itens.json")["itens"]
MONSTROS = j("dados", "monstros.json")["monstros"]
REGIOES = j("dados", "regioes.json")
MOSTR = {m["id"]: m for m in j("mostruario", "mostruario.json")["monstros"]}
CSV = {r["filename"] for r in csv.DictReader(open(os.path.join(RAIZ, "data", "gerador", "CREDITS.csv"), encoding="utf-8"))}
USADAS = {linha.strip() for linha in open(os.path.join(RAIZ, "data", "pecas_usadas.txt"), encoding="utf-8") if linha.strip() and not linha.startswith("#")}
CRED = open(os.path.join(RAIZ, "CREDITOS.md"), encoding="utf-8").read()


def test_todo_item_equipavel_tem_peca_lpc_existente_e_creditada():
    for it in ITENS:
        if it["tipo"] == "consumivel":
            continue
        assert it["peca_lpc"], f"{it['id']} sem peça LPC"
        for peca in it["peca_lpc"]:
            assert peca in CSV, f"{it['id']}: {peca} não existe no CSV do gerador"
            assert peca in USADAS, f"{it['id']}: {peca} não está em data/pecas_usadas.txt"


def test_toda_peca_usada_aparece_nos_creditos_do_jogo():
    for peca in USADAS:
        assert f"`{peca}`" in CRED, peca
    assert CRED == open(os.path.join(RAIZ, "docs", "CREDITOS.md"), encoding="utf-8").read()


def test_monstros_do_jogo_tem_animacoes_conforme_o_comportamento():
    for m in MONSTROS:
        spec = MOSTR[m["sprite"]]
        assert spec["andar"], m["id"]
        if m["comportamento"] in ("inimigo", "chefe"):
            assert spec["ataque"], f"{m['id']}: inimigo sem ataque"
        assert m["vida"] > 0 and m["dano"] > 0 and m["xp"] > 0


def test_regioes_referenciam_mapas_e_niveis_consistentes():
    mapas = REGIOES["mapas"]
    for r in REGIOES["regioes"]:
        if r["implementada"]:
            assert r["cidade"] in mapas and r["cacada"] in mapas
            for f in (mapas[r["cidade"]], mapas[r["cacada"]]):
                assert os.path.exists(os.path.join(RAIZ, "docs", f)), f
    assert [r["niveis"][0] for r in REGIOES["regioes"]] == [1, 10, 20]


def test_assets_do_jogo_existem():
    for f in ("forest_tiles", "dirt", "signs", "house", "soldier_altcolor", "princess"):
        assert os.path.exists(os.path.join(RAIZ, "docs", "assets", f + ".png")), f


def test_todo_item_vestivel_tem_visual_com_as_animacoes_do_guerreiro():
    from PIL import Image
    for it in ITENS:
        if it["tipo"] == "consumivel":
            continue
        v = it["visual"]
        for anim in ("walk", "slash", "thrust"):
            arq = os.path.join(RAIZ, "docs", "assets", "pecas", v[anim])
            assert os.path.exists(arq), f"{it['id']}: falta {v[anim]}"
            w, h = Image.open(arq).size
            q = 192 if anim in v.get("grande", []) else 64
            colunas = {"walk": 9, "slash": 6, "thrust": 8}[anim]
            assert h == 4 * q and w >= colunas * q, f"{it['id']} {anim}: {w}x{h} não tem 4 direções x {colunas} quadros de {q}px"


def test_corpo_do_personagem_tem_as_animacoes_e_esta_creditado():
    I = json.load(open(os.path.join(RAIZ, "docs", "dados", "itens.json"), encoding="utf-8"))
    for c in I["corpo"].values():
        if not isinstance(c, dict):
            continue
        for pasta in (c["base"], c["cabeca"]):
            for anim in ("walk", "slash", "thrust"):
                assert os.path.exists(os.path.join(RAIZ, "docs", "assets", "pecas", f"{pasta}/{anim}.png"))
                assert f"{pasta}/{anim}.png" in USADAS


def test_cada_espaco_tem_mais_de_uma_aparencia_na_regiao_1():
    for esp in ("arma", "capacete", "peitoral", "grevas"):
        visuais = {it["visual"]["walk"] for it in ITENS if it.get("espaco") == esp and it.get("nivel", 1) <= 9}
        assert len(visuais) >= 2, esp


def test_qualidades_tem_cor_e_tinta_valida():
    I = json.load(open(os.path.join(RAIZ, "docs", "dados", "itens.json"), encoding="utf-8"))
    tintas = [q["tinta"] for q in I["qualidades"]]
    assert tintas[0] == 0, "Comum mostra a peça original"
    assert all(0 <= t <= 0.6 for t in tintas) and tintas == sorted(tintas), "tinta cresce com a qualidade"
    assert all(q["cor"].startswith("#") and len(q["cor"]) == 7 for q in I["qualidades"])
