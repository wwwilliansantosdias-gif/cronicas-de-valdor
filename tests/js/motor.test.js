import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerMapaTexto, gerarMapa, alcancaveis, bloqueadoTile } from "../../docs/src/mapa.js";
import { ganharXp, novoEstado, xpParaProximo, NIVEL_MAX, portalLiberado, aoMorrer, statsJogador } from "../../docs/src/progresso.js";
import { criarMonstro, danoEm, golpear, atualizarMonstro } from "../../docs/src/combate.js";
import { carregar, guardar, serializar } from "../../docs/src/salvar.js";

const ler = (f) => readFileSync(new URL("../../docs/" + f, import.meta.url), "utf8");
const regioes = JSON.parse(ler("dados/regioes.json"));
const monstros = JSON.parse(ler("dados/monstros.json")).monstros;
const mapasTxt = Object.fromEntries(Object.entries(regioes.mapas).map(([id, f]) => [id, ler(f)]));
const gerar = (id) => gerarMapa(lerMapaTexto(mapasTxt[id]));

test("mesmo texto e mesma semente geram o mesmo mapa", () => {
  for (const id of Object.keys(mapasTxt)) {
    const a = gerar(id), b = gerar(id);
    assert.deepEqual([...a.bloq], [...b.bloq]);
    assert.deepEqual(a.spawns, b.spawns);
    assert.deepEqual(a.objetos, b.objetos);
  }
});

test("semente diferente muda o mapa de caça", () => {
  const s = lerMapaTexto(mapasTxt["mata-do-javali"]);
  const a = gerarMapa(s), b = gerarMapa({ ...s, semente: s.semente + 1 });
  assert.notDeepEqual([...a.bloq], [...b.bloq]);
});

test("há caminho entre entrada, chefe, spawns, npcs e portal", () => {
  for (const id of Object.keys(mapasTxt)) {
    const m = gerar(id);
    const vis = alcancaveis(m, m.inicio.x, m.inicio.y);
    const pontos = [...m.spawns, ...m.npcs, ...(m.chefe ? [m.chefe] : []), ...(m.portal ? [m.portal] : []), ...m.saidas.map((s) => s.entrada)];
    for (const p of pontos) assert.equal(vis[p.y * m.w + p.x], 1, `${id}: (${p.x},${p.y}) inalcançável`);
  }
});

test("nenhum monstro, npc ou portal nasce em peça bloqueada", () => {
  for (const id of Object.keys(mapasTxt)) {
    const m = gerar(id);
    for (const p of [...m.spawns, ...m.npcs, ...(m.chefe ? [m.chefe] : []), ...(m.portal ? [m.portal] : [])]) assert.equal(bloqueadoTile(m, p.x, p.y), false);
  }
});

test("área de caça tem de 6 a 10 monstros; cidade é zona segura sem monstros", () => {
  const caca = gerar("mata-do-javali"), cidade = gerar("pe-de-lenha");
  assert.ok(caca.spawns.length + (caca.chefe ? 1 : 0) >= 6 && caca.spawns.length + (caca.chefe ? 1 : 0) <= 10);
  assert.equal(cidade.zonaSegura, true);
  assert.equal(cidade.spawns.length, 0);
  assert.deepEqual(cidade.npcs.map((n) => n.tipo).sort(), ["ferreiro", "mercador", "quadro"]);
});

test("spawns são de monstros que existem", () => {
  const ids = new Set(monstros.map((m) => m.id));
  for (const id of Object.keys(mapasTxt)) {
    const m = gerar(id);
    for (const s of m.spawns) assert.ok(ids.has(s.tipo), s.tipo);
    if (m.chefe) assert.ok(ids.has(m.chefe.tipo));
  }
});

test("mapa com chave desconhecida ou sem tamanho é recusado", () => {
  assert.throws(() => lerMapaTexto("mapa: x\ntamanho: 10x10\nfoo: 1"));
  assert.throws(() => lerMapaTexto("mapa: x"));
});

test("experiência sobe o nível de forma monotônica e respeita o máximo", () => {
  const e = novoEstado();
  let ultimo = e.nivel;
  for (let i = 0; i < 3000; i++) { ganharXp(e, 50); assert.ok(e.nivel >= ultimo); ultimo = e.nivel; }
  assert.equal(e.nivel, NIVEL_MAX);
  for (let n = 1; n < NIVEL_MAX; n++) assert.ok(xpParaProximo(n + 1) > xpParaProximo(n));
});

test("subir de nível pode acontecer mais de uma vez com muito xp", () => {
  const e = novoEstado();
  assert.ok(ganharXp(e, 100000) > 1);
});

test("portal bloqueia abaixo do nível mínimo e libera no nível exato", () => {
  const r = regioes.regioes[0];
  const e = novoEstado();
  e.nivel = r.portal_proxima.nivel_minimo - 1;
  assert.equal(portalLiberado(e, r), false);
  e.nivel++;
  assert.equal(portalLiberado(e, r), true);
});

test("regiões: níveis contíguos e portal abre no primeiro nível da região seguinte", () => {
  const rs = regioes.regioes;
  for (let i = 0; i < rs.length - 1; i++) {
    assert.equal(rs[i].portal_proxima.para, rs[i + 1].id);
    assert.equal(rs[i].portal_proxima.nivel_minimo, rs[i + 1].niveis[0]);
    assert.equal(rs[i].niveis[1] + 1, rs[i + 1].niveis[0]);
  }
  assert.equal(rs.at(-1).portal_proxima, null);
});

test("morrer mantém o nível e perde só parte do ouro", () => {
  const e = novoEstado(); e.nivel = 7; e.ouro = 100;
  aoMorrer(e);
  assert.equal(e.nivel, 7);
  assert.ok(e.ouro > 0 && e.ouro < 100);
});

test("dano nunca deixa vida negativa e a morte dispara uma vez só", () => {
  const m = criarMonstro(monstros[0], 100, 100);
  assert.equal(danoEm(m, 5), false);
  assert.equal(danoEm(m, 9999), true);
  assert.equal(m.vida, 0);
  assert.equal(danoEm(m, 9999), false);
  assert.equal(m.vida, 0);
});

test("golpe só atinge monstros à frente, dentro do alcance", () => {
  const j = { x: 200, y: 200, dir: "right" };
  const perto = criarMonstro(monstros[0], 224, 200), atras = criarMonstro(monstros[0], 160, 200), longe = criarMonstro(monstros[0], 400, 200);
  golpear(j, [perto, atras, longe], 5);
  assert.ok(perto.vida < perto.vidaMax);
  assert.equal(atras.vida, atras.vidaMax);
  assert.equal(longe.vida, longe.vidaMax);
});

test("monstro persegue, ataca depois de uma janela e causa dano uma vez por ataque", () => {
  const mapa = gerar("mata-do-javali");
  const j = { x: 20 * 32, y: 20 * 32, morto: false };
  const m = criarMonstro(monstros[0], j.x + 80, j.y);
  let total = 0, passos = 0;
  while (passos++ < 60 * 3) total += atualizarMonstro(m, j, 1 / 60, mapa, () => 0.5);
  assert.ok(total >= monstros[0].dano, "causou dano");
  assert.ok(total % monstros[0].dano === 0);
});

test("monstro não entra em peça bloqueada ao perseguir", () => {
  const mapa = gerar("mata-do-javali");
  const j = { x: mapa.inicio.x * 32 + 16, y: mapa.inicio.y * 32 + 16, morto: false };
  const m = criarMonstro(monstros[0], j.x + 100, j.y);
  for (let i = 0; i < 600; i++) {
    atualizarMonstro(m, j, 1 / 60, mapa, () => 0.3);
    assert.equal(bloqueadoTile(mapa, Math.floor(m.x / 32), Math.floor((m.y - 4) / 32)), false);
  }
});

test("estatísticas crescem com o nível e com a melhoria da arma", () => {
  assert.ok(statsJogador(5).vidaMax > statsJogador(4).vidaMax);
  assert.ok(statsJogador(5, 2).dano > statsJogador(5, 1).dano);
});

function memoria() { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d }; }
const mapasValidos = Object.keys(mapasTxt);

test("salvar e carregar devolvem o mesmo estado", () => {
  const s = memoria(), e = novoEstado(); e.nivel = 12; e.xp = 33; e.ouro = 77; e.missoes = { javalis: { estado: "ativa", progresso: 2 } };
  assert.ok(guardar(s, e));
  assert.deepEqual(carregar(s, mapasValidos), e);
});

test("save corrompido ou adulterado não derruba: devolve null", () => {
  const s = memoria();
  assert.equal(carregar(s, mapasValidos), null);
  s.setItem("valdor-save", "{não é json");
  assert.equal(carregar(s, mapasValidos), null);
  for (const mut of [{ nivel: 0 }, { nivel: 99 }, { ouro: -1 }, { mapa: "inexistente" }, { versao: 2 }, { xp: "x" }, { armaNivel: 9 }]) {
    s.setItem("valdor-save", serializar({ ...novoEstado(), ...mut }));
    assert.equal(carregar(s, mapasValidos), null, JSON.stringify(mut));
  }
  const quebrado = { getItem() { throw new Error("bloqueado"); } };
  assert.equal(carregar(quebrado, mapasValidos), null);
});
