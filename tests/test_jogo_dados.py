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
    for f in ("guerreiro_walk", "guerreiro_slash", "guerreiro_slash_arma", "forest_tiles", "dirt", "signs", "house", "soldier_altcolor", "princess"):
        assert os.path.exists(os.path.join(RAIZ, "docs", "assets", f + ".png")), f
