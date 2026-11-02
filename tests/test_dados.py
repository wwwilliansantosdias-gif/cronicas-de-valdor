"""Testes dos dados do mostruario: garantem as regras de credito e de animacao do projeto."""
import json
import os
import re

import pytest
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def carregar(*p):
    return json.load(open(os.path.join(RAIZ, *p), encoding="utf-8"))


MOSTRUARIO = carregar("docs", "mostruario", "mostruario.json")
META = carregar("data", "meta.json")
CREDITOS = open(os.path.join(RAIZ, "CREDITOS.md"), encoding="utf-8").read()
ESTADOS = {"ok", "sem_ataque", "a_conferir", "indisponivel"}


def anims(m):
    return [(k, m[k]) for k in ("andar", "ataque", "morte") if m.get(k)]


def test_todo_pacote_usado_esta_nos_creditos():
    usados = {p["slug"] for s in MOSTRUARIO["monstros"] + MOSTRUARIO["cenarios"] for p in s["pacotes_info"]}
    for slug in usados:
        titulo = META[slug].get("titulo", slug)
        assert f"## {titulo}" in CREDITOS, f"{slug} sem secao em CREDITOS.md"


def test_pacote_sem_atribuicao_fica_marcado_nos_creditos():
    for slug, m in META.items():
        if m.get("erro") or m.get("atribuicao"):
            continue
        bloco = CREDITOS.split(f"## {m['titulo']}")[1].split("\n## ")[0]
        assert "não traz texto de atribuição" in bloco, slug


def test_estados_validos_e_coerentes_com_animacao_de_ataque():
    for m in MOSTRUARIO["monstros"]:
        assert m["estado"] in ESTADOS, m["id"]
        if m["estado"] == "ok":
            assert m["andar"] and m["ataque"], f"{m['id']}: inimigo 'ok' precisa de andar e ataque"
        if m["estado"] == "sem_ataque":
            assert not m["ataque"], m["id"]


@pytest.mark.parametrize("m", MOSTRUARIO["monstros"], ids=lambda m: m["id"])
def test_quadros_cabem_na_imagem(m):
    for nome, a in anims(m):
        caminho = os.path.join(RAIZ, "docs", "mostruario", a["file"])
        assert os.path.exists(caminho), (m["id"], nome)
        w, h = Image.open(caminho).size
        for fr in a["frames"]:
            assert a["x0"] + (fr + 1) * a["fw"] <= w, (m["id"], nome, "coluna fora da imagem")
        for linha in a["rows"].values():
            assert a["y0"] + (linha + 1) * a["fh"] <= h, (m["id"], nome, "linha fora da imagem")


def test_quadros_nao_sao_vazios():
    for m in MOSTRUARIO["monstros"]:
        for nome, a in anims(m):
            im = Image.open(os.path.join(RAIZ, "docs", "mostruario", a["file"])).convert("RGBA")
            for d, linha in a["rows"].items():
                for fr in a["frames"]:
                    box = (a["x0"] + fr * a["fw"], a["y0"] + linha * a["fh"], a["x0"] + (fr + 1) * a["fw"], a["y0"] + (linha + 1) * a["fh"])
                    vazio = im.crop(box).getchannel("A").getbbox() is None
                    # quadros vazios sao toleraveis so no fim da linha (animacao mais curta nessa direcao)
                    if vazio:
                        assert fr != a["frames"][0], (m["id"], nome, d, "primeiro quadro vazio")


def test_nenhum_arquivo_publicado_sem_uso():
    usados = set()
    for s in MOSTRUARIO["monstros"] + MOSTRUARIO["cenarios"]:
        for k in ("andar", "ataque", "morte"):
            if s.get(k):
                usados.add(s[k]["file"])
        if s.get("folha"):
            usados.add(s["folha"])
        for i in s.get("imagens", []):
            usados.add(i["file"])
    existentes = {f"img/{f}" for f in os.listdir(os.path.join(RAIZ, "docs", "mostruario", "img"))}
    assert existentes == usados


def test_gerador_creditos_csv_tem_colunas_esperadas():
    cab = open(os.path.join(RAIZ, "data", "gerador", "CREDITS.csv"), encoding="utf-8").readline().strip()
    assert cab == "filename,notes,authors,licenses,urls"


def test_creditos_nao_tem_pacote_com_erro():
    assert not re.search(r"Página não encontrada", CREDITOS.split("## cave-stairs")[0] if "## cave-stairs" in CREDITOS else CREDITOS)
