# Crônicas de Valdor

RPG de ação 2D de uso pessoal, no navegador do celular (tela deitada), com arte gratuita no estilo LPC.

- `docs/` – mostruário publicado pelo GitHub Pages (Settings → Pages → branch `main`, pasta `/docs`).
- `CREDITOS.md` – autores e licenças de tudo o que foi baixado (gerado).
- `data/` – manifesto dos pacotes (`packs.json`), metadados lidos do OpenGameArt (`meta.json`) e a especificação do mostruário (`mostruario.json`).
- `tools/` – scripts que baixam os pacotes e geram o mostruário.

## Regenerar o mostruário

```bash
pip install pillow
python3 -I tools/meta_packs.py        # lê autor/licença/arquivos de cada pacote
python3 -I tools/download_packs.py    # baixa para assets/raw (não versionado)
python3 -I tools/build_mostruario.py  # gera docs/ e CREDITOS.md
```
