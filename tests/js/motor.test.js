import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerMapaTexto, gerarMapa, alcancaveis, bloqueadoTile } from "../../docs/src/mapa.js";
import { ganharXp, novoEstado as novoEstadoBase, xpParaProximo, portalLiberado, aoMorrer } from "../../docs/src/progresso.js";
import { criarMonstro, danoEm, atingir, atualizarMonstro, dentroDaArea, danoHabilidade, recargaHabilidade } from "../../docs/src/combate.js";
import { carregar as carregarBase, guardar, serializar, migrarV1 } from "../../docs/src/salvar.js";
import { derivados, distribuir, distribuirRecomendado, redistribuir, aoSubir, gastos, pontosAteNivel, novoItem } from "../../docs/src/personagem.js";
import { media } from "../../tools/simular.mjs";

const ler = (f) => readFileSync(new URL("../../docs/" + f, import.meta.url), "utf8");
const regioes = JSON.parse(ler("dados/regioes.json"));
const monstros = JSON.parse(ler("dados/monstros.json")).monstros;
const mapasTxt = Object.fromEntries(Object.entries(regioes.mapas).map(([id, f]) => [id, ler(f)]));
const gerar = (id) => gerarMapa(lerMapaTexto(mapasTxt[id]));
const P = JSON.parse(ler("dados/progressao.json")), I = JSON.parse(ler("dados/itens.json"));
const H = JSON.parse(ler("dados/habilidades.json")), C = JSON.parse(ler("dados/classes.json")).classes;
const NIVEL_MAX = P.nivel_max;
const novoEstado = () => novoEstadoBase(P, I);
const recomendado = C.find((c) => c.id === "guerreiro").recomendado;
const hab = (id) => H.habilidades.find((h) => h.id === id);

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
  for (let i = 0; i < 30000; i++) { ganharXp(P, e, 50); assert.ok(e.nivel >= ultimo); ultimo = e.nivel; }
  assert.equal(e.nivel, NIVEL_MAX);
  for (let n = 1; n < NIVEL_MAX; n++) assert.ok(xpParaProximo(P, n + 1) > xpParaProximo(P, n));
});

test("subir de nível pode acontecer mais de uma vez com muito xp", () => {
  const e = novoEstado();
  assert.ok(ganharXp(P, e, 100000) > 1);
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

test("golpe (arco) só atinge à frente e dentro do alcance", () => {
  const j = { x: 200, y: 200, dir: "right" };
  const perto = criarMonstro(monstros[0], 224, 200), atras = criarMonstro(monstros[0], 160, 200), longe = criarMonstro(monstros[0], 400, 200);
  atingir(j, [perto, atras, longe], hab("golpe"), 5, 0);
  assert.ok(perto.vida < perto.vidaMax);
  assert.equal(atras.vida, atras.vidaMax);
  assert.equal(longe.vida, longe.vidaMax);
});

test("estocada (linha) alcança mais longe que o golpe; giro (círculo) atinge atrás", () => {
  const j = { x: 200, y: 200, dir: "right" };
  const longe = criarMonstro(monstros[0], 258, 200), atras = criarMonstro(monstros[0], 165, 200);
  assert.equal(dentroDaArea(j, longe, hab("golpe")), false);
  assert.equal(dentroDaArea(j, longe, hab("estocada")), true);
  assert.equal(dentroDaArea(j, atras, hab("estocada")), false);
  assert.equal(dentroDaArea(j, atras, hab("giro")), true);
});

test("grau da habilidade aumenta o dano e reduz a recarga; agilidade reduz a recarga até o mínimo", () => {
  const h = hab("golpe");
  assert.ok(danoHabilidade(h, H.por_grau, 10, 3) > danoHabilidade(h, H.por_grau, 10, 1));
  assert.ok(recargaHabilidade(h, H.por_grau, 1, 3) < recargaHabilidade(h, H.por_grau, 1, 1));
  const e = novoEstado(); e.atributos.agi = 999;
  assert.equal(derivados(P, I, e).recargaMult, P.derivados.recarga_min);
});

test("crítico multiplica o dano e respeita o limite de Sorte", () => {
  const j = { x: 200, y: 200, dir: "right" };
  const a = criarMonstro({ ...monstros[0], vida: 1000 }, 224, 200), b = criarMonstro({ ...monstros[0], vida: 1000 }, 224, 200);
  atingir(j, [a], hab("golpe"), 10, 0); atingir(j, [b], hab("golpe"), 10, 1, 1.5, () => 0);
  assert.equal(1000 - a.vida, 10); assert.equal(1000 - b.vida, 15);
  const e = novoEstado(); e.atributos.sor = 999;
  assert.equal(derivados(P, I, e).critico, P.derivados.critico_max);
});

test("pontos: ganha 3 por nível; distribuídos + livres sempre somam o total do nível", () => {
  const e = novoEstado(); e.autoDistribuir = false;
  const n = ganharXp(P, e, 5000); aoSubir(P, e, n, recomendado);
  assert.equal(gastos(P, e) + e.pontosLivres, pontosAteNivel(P, e.nivel));
  assert.equal(distribuir(P, e, "for", e.pontosLivres + 1), false, "não gasta mais do que tem");
  assert.equal(distribuir(P, e, "xyz", 1), false);
  assert.ok(distribuir(P, e, "for", 2));
  assert.equal(gastos(P, e) + e.pontosLivres, pontosAteNivel(P, e.nivel));
});

test("modo recomendado distribui todos os pontos na proporção da classe", () => {
  const e = novoEstado(); e.pontosLivres = 9;
  distribuirRecomendado(P, e, recomendado);
  assert.equal(e.pontosLivres, 0);
  assert.equal(e.atributos.for - P.atributo_inicial, 6);
  assert.equal(e.atributos.vit - P.atributo_inicial, 3);
});

test("redistribuir devolve exatamente os pontos gastos, cobra ouro e recusa sem ouro", () => {
  const e = novoEstado(); e.nivel = 5; e.pontosLivres = pontosAteNivel(P, 5); distribuirRecomendado(P, e, recomendado);
  e.ouro = 0;
  assert.equal(redistribuir(P, e), false);
  e.ouro = 1000; e.autoDistribuir = true;
  assert.ok(redistribuir(P, e));
  assert.equal(e.autoDistribuir, false, "redistribuir desliga o modo automático");
  assert.equal(e.pontosLivres, pontosAteNivel(P, 5));
  assert.equal(e.ouro, 1000 - P.redistribuir_custo_por_nivel * 5);
  assert.equal(redistribuir(P, e), false, "nada a devolver");
});

test("equipamento: qualidade e +N aumentam os valores; tirar o item reduz", () => {
  const e = novoEstado();
  const base = derivados(P, I, e);
  e.equip.arma = novoItem("espada-longa", "raro", 2);
  assert.ok(derivados(P, I, e).dano > base.dano);
  e.equip.peitoral = null;
  assert.ok(derivados(P, I, e).vidaMax < base.vidaMax);
  e.equip.capacete = novoItem("elmo-armet", "comum", 0, { sor: 3 });
  assert.equal(derivados(P, I, e).atributos.sor, e.atributos.sor + 3);
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

test("ritmo: nível 10 em cerca de 30 minutos (média de 20 simulações; alvo da média dos jogos de referência)", () => {
  const m = media(10, 20);
  assert.ok(m.minutos >= 25 && m.minutos <= 35, `${m.minutos.toFixed(1)} min`);
  assert.ok(m.mortes < 3, "não deveria morrer muito na região 1");
});

function memoria() { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d }; }
const mapasValidos = Object.keys(mapasTxt);
const carregar = (s, mv) => carregarBase(P, I, s, mv);

test("salvar e carregar devolvem o mesmo estado", () => {
  const s = memoria(), e = novoEstado(); e.nivel = 12; e.xp = 33; e.ouro = 77; e.missoes = { javalis: { estado: "ativa", progresso: 2 } };
  e.pontosLivres = pontosAteNivel(P, 12); distribuirRecomendado(P, e, recomendado);
  assert.ok(guardar(s, e));
  assert.deepEqual(carregar(s, mapasValidos), e);
});

test("save corrompido ou adulterado não derruba: devolve null", () => {
  const s = memoria();
  assert.equal(carregar(s, mapasValidos), null);
  s.setItem("valdor-save", "{não é json");
  assert.equal(carregar(s, mapasValidos), null);
  for (const mut of [{ nivel: 0 }, { nivel: 99 }, { ouro: -1 }, { mapa: "inexistente" }, { versao: 3 }, { xp: "x" },
    { atributos: { for: 2, vit: 5, agi: 5, sor: 5 } }, { equip: { arma: { base: "nao-existe", qual: "comum", mais: 0, bonus: {} } } }, { mochila: "x" }]) {
    s.setItem("valdor-save", serializar({ ...novoEstado(), ...mut }));
    assert.equal(carregar(s, mapasValidos), null, JSON.stringify(mut));
  }
  const quebrado = { getItem() { throw new Error("bloqueado"); } };
  assert.equal(carregar(quebrado, mapasValidos), null);
});

test("pontos inconsistentes com o nível são consertados ao carregar, sem perder o save", () => {
  const s = memoria();
  const e = novoEstado(); e.nivel = 10; e.ouro = 300; e.pontosLivres = 3; // nível mudou sem os pontos
  s.setItem("valdor-save", serializar(e));
  const c = carregar(s, mapasValidos);
  assert.ok(c, "não descartou"); assert.equal(c.ouro, 300);
  assert.equal(gastos(P, c) + c.pontosLivres, pontosAteNivel(P, 10));
  const f = novoEstado(); f.nivel = 2; f.atributos.for = 60; // mais gasto que o possível
  s.setItem("valdor-save", serializar(f));
  const d = carregar(s, mapasValidos);
  assert.ok(d); assert.equal(d.atributos.for, P.atributo_inicial); assert.equal(d.pontosLivres, pontosAteNivel(P, 2));
});

test("save da versão 1 é migrado sem perder nível, ouro nem a arma afiada", () => {
  const s = memoria();
  const v1 = { versao: 1, classe: "guerreiro", nivel: 7, xp: 12, ouro: 55, pocoes: 2, armaNivel: 2, mapa: "mata-do-javali", missoes: { javalis: { estado: "pronta", progresso: 6 } } };
  s.setItem("valdor-save", JSON.stringify(v1));
  const e = carregar(s, mapasValidos);
  assert.ok(e, "migrou");
  assert.equal(e.versao, 2); assert.equal(e.nivel, 7); assert.equal(e.ouro, 55); assert.equal(e.mapa, "mata-do-javali");
  assert.equal(e.equip.arma.mais, 2);
  assert.deepEqual(e.missoes, v1.missoes);
  assert.equal(gastos(P, e) + e.pontosLivres, pontosAteNivel(P, 7));
  assert.equal(e.pontosHab, Math.floor(7 / P.nivel_por_ponto_habilidade));
  assert.equal(migrarV1(P, I, { ...v1, armaNivel: 0 }).equip.arma.mais, 0);
});
