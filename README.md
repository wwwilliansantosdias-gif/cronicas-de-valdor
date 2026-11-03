# Crônicas de Valdor

RPG de ação 2D de uso pessoal, no navegador do celular (tela deitada), com arte gratuita no estilo LPC.

**Jogar:** https://wwwilliansantosdias-gif.github.io/cronicas-de-valdor/ · **Mostruário de arte:** `.../mostruario/`

Estado: três regiões jogáveis com o Guerreiro, o Arqueiro ou o Mago (escolha ao criar o personagem, junto com a aparência: pele, rosto, cabelo, barba e olhos). Floresta (níveis 1–9): Pé-de-Lenha e Mata do Javali. Caverna (10–19): Veio-Fundo e Galerias Rasas, chefe Golem do Veio. Ruínas (20–29): Cinzaltar e Campo das Lápides, chefe Rei Esquelético. Os portais das cidades abrem nos níveis 10 e 20 e levam de volta. Cada cidade tem mercador, ferreiro (melhoria até +5) e quadro de missões. Atributos, 5 habilidades por classe (Guerreiro: Golpe, Estocada, Giro, Terremoto, Investida; Arqueiro: Disparo, Dispersão, Chuva, Rajada, Perfurante; Mago: Faísca, Leão de Fogo, Espinhos de Gelo, Escudo de Gelo, Tornado), itens com qualidade que caem mais e melhores a cada região e aparecem no personagem (ver `documentacao/etapa-7-equipamentos.md` e `etapa-8-regioes.md`). Progressão: `documentacao/etapa-6b-progressao.md`.

## Pastas
- `docs/` – o que o GitHub Pages publica (Settings → Pages → branch `main`, pasta `/docs`): jogo (`index.html`, `src/`, `dados/`, `mapas/`, `assets/`), `mostruario/` e `CREDITOS.md`.
- `documentacao/` – etapas 2 a 5 e 6b a 10 (história, arte, documentação técnica, testes, progressão, equipamentos, regiões 2 e 3, aparência, mago) e `futuro-3d.md` (protótipo 3D para a versão 2).
- `data/` – metadados dos pacotes (`packs.json`, `meta.json`), especificação do mostruário, peças do gerador LPC usadas (`pecas_usadas.txt`) e `gerador/CREDITS.csv`.
- `tools/` – scripts de download, créditos e build. `tests/` – testes.

## Rodar
Abrir `docs/` num servidor estático (ex.: `python3 -m http.server -d docs`). Teclado: setas/WASD, espaço ataca, 1 a 4 habilidades, E fala, Q poção.

## Testes
```bash
pip install pytest pillow && python3 -m pytest -q tests     # dados e créditos
node --test tests/js/*.test.js                               # motor (mapas, combate, xp, atributos, salvar, ritmo)
node tools/simular.mjs 29 mago                               # minutos até cada nível (guerreiro, arqueiro ou mago)
for t in fumaca fluxo atributos combate mochila arqueiro habilidades aparencia mago telas; do PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/$t.mjs; done   # navegador, tela deitada
```

## Regenerar assets e créditos
```bash
python3 -I tools/meta_packs.py && python3 -I tools/download_packs.py   # pacotes do OpenGameArt (assets/raw, não versionado)
python3 -I tools/build_mostruario.py     # docs/mostruario + CREDITOS.md
python3 -I tools/build_jogo_assets.py    # baixa as peças dos itens (gerador LPC), gera pecas_usadas.txt, copia tiles/NPCs
python3 -I tools/build_cidade.py         # monta casas, forja, barraca, quadro, fonte e poço em docs/assets/cidade
```
Item novo: acrescente em `docs/dados/itens.json` (com `peca_lpc` e `visual`) e rode `build_jogo_assets.py` e depois `build_mostruario.py` (créditos).

## Gravar uma partida
`PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tools/gravar_partida.mjs <pasta> [regioes]` grava um vídeo (webm) de um robô jogando; com `regioes`, mostra a Caverna e as Ruínas.
