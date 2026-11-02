"""Credita pecas do gerador LPC usadas no jogo.

Uso: python3 -I tools/creditos_pecas.py data/pecas_usadas.txt
O arquivo lista um caminho de peca por linha (como na coluna `filename` de data/gerador/CREDITS.csv).
Imprime o bloco de creditos em Markdown; pecas nao encontradas geram erro (nunca inventar credito).
"""
import csv
import sys


def linhas(arquivo):
    rows = {r["filename"]: r for r in csv.DictReader(open("data/gerador/CREDITS.csv", encoding="utf-8"))}
    saida, faltam = [], []
    for linha in open(arquivo, encoding="utf-8"):
        nome = linha.strip()
        if not nome or nome.startswith("#"):
            continue
        r = rows.get(nome)
        if not r:
            faltam.append(nome)
            continue
        saida.append(f"- `{nome}`: {r['authors'].strip()} | {r['licenses'].strip()} | {r['urls'].strip() or r['notes'].strip()}")
    if faltam:
        raise SystemExit("Pecas sem credito no CSV: " + ", ".join(faltam))
    return saida


if __name__ == "__main__":
    print("\n".join(linhas(sys.argv[1])))
