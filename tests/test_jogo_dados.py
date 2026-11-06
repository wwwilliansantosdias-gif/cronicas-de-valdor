"""Testes dos dados do jogo (docs/dados): itens, monstros, regioes e creditos."""
import csv
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def j(*p):
    return json.load(open(os.path.join(RAIZ, "docs", *p), encoding="utf-8"))


ITENS = j("dados", "itens.json")["itens"]
MONSTROS = j("dados", "monstros.json")["monstros"]
REGIOES = j("dados", "regioes.json")
MOSTR = {m["id"]: m for m in j("mostruario", "mostruario.json")["monstros"]}
CRED = open(os.path.join(RAIZ, "CREDITOS.md"), encoding="utf-8").read()


def test_creditos_do_jogo_iguais_aos_da_raiz():
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


def test_cada_espaco_tem_mais_de_uma_aparencia_na_regiao_1():
    for esp in ("arma", "capacete", "peitoral", "grevas", "bracos", "botas"):
        visuais = {json.dumps(it["formato"], sort_keys=True) for it in ITENS if it.get("espaco") == esp and it.get("nivel", 1) <= 9}
        assert len(visuais) >= 2, esp


def test_qualidades_tem_cor_valida():
    I = json.load(open(os.path.join(RAIZ, "docs", "dados", "itens.json"), encoding="utf-8"))
    assert all(q["cor"].startswith("#") and len(q["cor"]) == 7 for q in I["qualidades"])


def test_toda_construcao_citada_nos_mapas_tem_imagem():
    import glob
    import re
    for mapa in glob.glob(os.path.join(RAIZ, "docs", "mapas", "*.txt")):
        for linha in open(mapa, encoding="utf-8"):
            m = re.match(r"predio:\s+([a-z_]+)\s+\d+,\d+\s+(\d+)x(\d+)", linha)
            if m:
                arq = os.path.join(RAIZ, "docs", "assets", "cidade", m.group(1) + ".png")
                assert os.path.exists(arq), f"{os.path.basename(mapa)}: falta {m.group(1)}.png"
                from PIL import Image
                w, h = Image.open(arq).size
                assert w <= int(m.group(2)) * 32 + 32, f"{m.group(1)} mais larga que a área no mapa"


def test_cada_regiao_tem_equipamento_para_todos_os_espacos():
    I = json.load(open(os.path.join(RAIZ, "docs", "dados", "itens.json"), encoding="utf-8"))
    for lo, hi in ((1, 9), (10, 19), (20, 29)):
        for esp in I["espacos"]:
            if esp == "capa" and lo == 1:
                continue
            assert any(it.get("espaco") == esp and lo <= it["nivel"] <= hi for it in I["itens"]), f"{esp} sem item entre {lo} e {hi}"


def test_conjuntos_validos():
    I = json.load(open(os.path.join(RAIZ, "docs", "dados", "itens.json"), encoding="utf-8"))
    ids = {it["id"] for it in I["itens"]}
    for c in I["conjuntos"]:
        assert all(p in ids for p in c["pecas"]), c["id"]
        assert not set(c["pecas"]) & set(I["equipamento_inicial"]["guerreiro"].values()), "conjunto não pode vir no equipamento inicial"


def test_cenario_usa_folhas_que_existem_e_estao_creditadas():
    cen = json.load(open(os.path.join(RAIZ, "docs", "dados", "cenario.json"), encoding="utf-8"))
    usadas = {b["img"] for b in cen["bases"].values()}
    usadas |= {o["img"] for lista in cen["obstaculos"].values() for o in lista}
    usadas |= {l["img"] for l in cen["lagoas"].values()}
    pacote = {"forest_tiles": "lpc-forest-tiles", "cavern_ruins": "lpc-cavern-and-ruin-tiles", "dirt": "liberated-pixel-cup-lpc-base-assets-sprites-map-tiles"}
    for img in usadas:
        assert os.path.exists(os.path.join(RAIZ, "docs", "assets", img + ".png")), img
        assert "opengameart.org/content/" + pacote[img] in CRED, f"{img}.png sem crédito do pacote em CREDITOS.md"
    for m in os.listdir(os.path.join(RAIZ, "docs", "mapas")):
        txt = open(os.path.join(RAIZ, "docs", "mapas", m), encoding="utf-8").read()
        base = re.search(r"^base:\s*(\S+)", txt, re.M)
        assert base is None or base.group(1) in cen["bases"], m
        obs = re.search(r"^obstaculos:\s*(.+)$", txt, re.M)
        for o in (obs.group(1).split(",") if obs else []):
            assert o.strip() in cen["obstaculos"], (m, o)
