import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerMapaTexto, gerarMapa, alcancaveis, bloqueadoTile } from "../../docs/src/mapa.js";
import { ganharXp, novoEstado as novoEstadoBase, xpParaProximo, portalLiberado, aoMorrer } from "../../docs/src/progresso.js";
import { criarMonstro, danoEm, atingir, atualizarMonstro, dentroDaArea, danoHabilidade, recargaHabilidade, escalarArea } from "../../docs/src/combate.js";
import { carregar as carregarBase, guardar, serializar, migrarV1 } from "../../docs/src/salvar.js";
import { estatisticas, derivados, distribuir, distribuirRecomendado, redistribuir, aoSubir, gastos, pontosAteNivel, novoItem, desbloquearHabilidades, melhorarHabilidade } from "../../docs/src/personagem.js";
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
  const total = caca.spawns.length + (caca.chefe ? 1 : 0);
  const esperado = lerMapaTexto(mapasTxt["mata-do-javali"]).spawns.reduce((t, s) => t + s.n * s.grupo, 0) + 1;
  assert.equal(total, esperado, "todo bando do texto do mapa é colocado inteiro");
  assert.ok(total >= 30 && total <= 48, "volume de monstros por área: " + total);
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

test("bandos: membros ficam a até 2 peças do centro e bandos ficam separados", () => {
  const m = gerar("mata-do-javali");
  const porBando = {};
  for (const p of m.spawns) (porBando[p.bando] ??= []).push(p);
  const bandos = Object.values(porBando);
  assert.ok(bandos.length >= 10);
  for (const b of bandos) { assert.ok(b.every((p) => p.tipo === b[0].tipo)); for (const p of b) assert.ok(Math.abs(p.x - b[0].x) <= 2 && Math.abs(p.y - b[0].y) <= 2); }
  for (let i = 0; i < bandos.length; i++) for (let j = i + 1; j < bandos.length; j++) assert.ok(Math.hypot(bandos[i][0].x - bandos[j][0].x, bandos[i][0].y - bandos[j][0].y) >= 6);
  assert.throws(() => lerMapaTexto("mapa: x\ntamanho: 10x10\nspawn: javali 2 bando 3"));
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

test("habilidades liberam no nível certo, no grau 1; pontos de habilidade sobem o grau até o máximo", () => {
  const e = novoEstado(); e.autoDistribuir = true;
  const habsG = C.find((c) => c.id === "guerreiro").habilidades.map(hab);
  desbloquearHabilidades(e, habsG);
  assert.deepEqual(Object.keys(e.habilidades), ["golpe"]);
  aoSubir(P, e, ganharXp(P, e, xpParaProximo(P, 1) + xpParaProximo(P, 2)), recomendado, habsG);
  assert.equal(e.nivel, 3); assert.equal(e.habilidades.estocada, 1); assert.equal(e.habilidades.giro, undefined);
  assert.equal(e.pontosHab, 1);
  assert.ok(melhorarHabilidade(P, e, "estocada")); assert.equal(e.habilidades.estocada, 2); assert.equal(e.pontosHab, 0);
  assert.equal(melhorarHabilidade(P, e, "estocada"), false, "sem pontos");
  assert.equal(melhorarHabilidade(P, e, "giro"), false, "não liberada");
  e.pontosHab = 99; while (melhorarHabilidade(P, e, "golpe"));
  assert.equal(e.habilidades.golpe, P.grau_max_habilidade);
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

const def = (id) => monstros.find((m) => m.id === id);
// arena aberta: mapa sem obstáculos para testar ataques
const arena = { w: 40, h: 40, bloq: new Uint8Array(1600) };
function rodar(m, j, seg, cada) { let dano = 0, veneno = null; for (let i = 0; i < seg * 60; i++) { cada?.(i); const r = atualizarMonstro(m, j, 1 / 60, arena, () => 0.5); dano += r.dano; veneno = veneno || r.veneno; } return { dano, veneno }; }

test("todo monstro do jogo tem ataques com tipo conhecido e números válidos", () => {
  for (const m of monstros) {
    assert.ok(m.ataques.length > 0, m.id);
    for (const a of m.ataques) {
      assert.ok(["corpo", "investida", "area", "linha"].includes(a.tipo), m.id + a.id);
      assert.ok(a.aviso > 0 && a.recarga > 0 && a.mult > 0 && a.alcance > 0, m.id + a.id);
      if (a.tipo === "investida") assert.ok(a.velocidade > 0 && a.duracao > 0);
    }
  }
});

test("goblin avisa antes de bater: nada de dano durante o aviso", () => {
  const j = { x: 400, y: 400, morto: false }, m = criarMonstro(def("goblin"), 418, 400);
  m.estado = "perseguir";
  const a = def("goblin").ataques[0];
  assert.equal(rodar(m, j, a.aviso * 0.9).dano, 0);
  assert.ok(rodar(m, j, 0.2).dano > 0);
});

test("investida do javali: direção travada no aviso; quem sai da linha não é atingido", () => {
  const fica = { x: 400, y: 400, morto: false }, m1 = criarMonstro(def("javali"), 300, 400); m1.estado = "perseguir";
  assert.ok(rodar(m1, fica, 1.2).dano > 0, "parado na linha: atingido");
  const sai = { x: 400, y: 400, morto: false }, m2 = criarMonstro(def("javali"), 300, 400); m2.estado = "perseguir";
  const r = rodar(m2, sai, 1.2, (i) => { if (i === 5) sai.y = 470; });
  assert.equal(r.dano, 0, "saiu da linha durante o aviso: escapou");
});

test("bote da cobra envenena; recarga impede ataque contínuo", () => {
  const j = { x: 400, y: 400, morto: false }, m = criarMonstro(def("cobra"), 430, 400); m.estado = "perseguir";
  const r = rodar(m, j, 0.8);
  assert.ok(r.dano > 0 && r.veneno && r.veneno.dps > 0);
  const a = def("cobra").ataques[0], max = Math.ceil(3 / (a.aviso + a.recarga)) + 1;
  assert.ok(rodar(m, j, 3).dano <= max * def("cobra").dano * a.mult, "respeita a recarga");
});

test("pisão do chefe atinge em volta, inclusive atrás; fora do raio não", () => {
  const perto = { x: 400, y: 400, morto: false }, c1 = criarMonstro(def("javali-coroado"), 350, 400); c1.estado = "perseguir";
  assert.ok(rodar(c1, perto, 1).dano > 0);
  const pisao = def("javali-coroado").ataques.find((a) => a.tipo === "area");
  const c2 = criarMonstro(def("javali-coroado"), 300, 400); c2.estado = "preparar"; c2.atq = pisao; c2.t = 0; c2.alvo = [1, 0]; c2.cd = {};
  const longe = { x: 300 + pisao.raio + 30, y: 400, morto: false };
  assert.equal(atualizarMonstro(c2, longe, pisao.aviso + 0.01, arena).dano, 0);
});

test("monstro não entra em peça bloqueada ao perseguir", () => {
  const mapa = gerar("mata-do-javali");
  const j = { x: mapa.inicio.x * 32 + 16, y: mapa.inicio.y * 32 + 16, morto: false };
  const m = criarMonstro(monstros[0], j.x + 100, j.y);
  for (let i = 0; i < 600; i++) {
    atualizarMonstro(m, j, 1 / 60, mapa, () => 0.3);
    if (m.estado === "recuperar") m.estado = "perseguir";
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
  e.pontosHab = Math.floor(12 / P.nivel_por_ponto_habilidade);
  assert.ok(guardar(s, e));
  assert.deepEqual(carregar(s, mapasValidos), e);
});

test("save corrompido ou adulterado não derruba: devolve null", () => {
  const s = memoria();
  assert.equal(carregar(s, mapasValidos), null);
  s.setItem("valdor-save", "{não é json");
  assert.equal(carregar(s, mapasValidos), null);
  for (const mut of [{ nivel: 0 }, { nivel: 99 }, { ouro: -1 }, { mapa: "inexistente" }, { versao: 4 }, { xp: "x" },
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

test("graus de habilidade acima do possível são consertados ao carregar", () => {
  const s = memoria(), e = novoEstado(); e.nivel = 3; e.habilidades = { golpe: 5, estocada: 4 };
  e.pontosLivres = pontosAteNivel(P, 3);
  s.setItem("valdor-save", serializar(e));
  const c = carregar(s, mapasValidos);
  assert.ok(c); assert.deepEqual(c.habilidades, { golpe: 1, estocada: 1 }); assert.equal(c.pontosHab, 1);
});

test("save da versão 1 é migrado sem perder nível, ouro nem a arma afiada", () => {
  const s = memoria();
  const v1 = { versao: 1, classe: "guerreiro", nivel: 7, xp: 12, ouro: 55, pocoes: 2, armaNivel: 2, mapa: "mata-do-javali", missoes: { javalis: { estado: "pronta", progresso: 6 } } };
  s.setItem("valdor-save", JSON.stringify(v1));
  const e = carregar(s, mapasValidos);
  assert.ok(e, "migrou");
  assert.equal(e.versao, 3); assert.equal(e.nivel, 7); assert.equal(e.ouro, 55); assert.equal(e.mapa, "mata-do-javali");
  assert.equal(e.equip.arma.mais, 2);
  assert.deepEqual(e.missoes, v1.missoes);
  assert.equal(gastos(P, e) + e.pontosLivres, pontosAteNivel(P, 7));
  assert.equal(e.pontosHab, Math.floor(7 / P.nivel_por_ponto_habilidade));
  assert.equal(migrarV1(P, I, { ...v1, armaNivel: 0 }).equip.arma.mais, 0);
});

test("leque (Dispersão): acerta vários à frente, não atrás nem fora do ângulo", () => {
  const h = hab("dispersao"), j = { x: 200, y: 200, dir: "right" };
  const frente = [criarMonstro(monstros[0], 300, 200), criarMonstro(monstros[0], 320, 240), criarMonstro(monstros[0], 330, 160)];
  const atras = criarMonstro(monstros[0], 120, 200), lado = criarMonstro(monstros[0], 210, 330), longe = criarMonstro(monstros[0], 450, 200);
  const r = atingir(j, [...frente, atras, lado, longe], h, 5, 0);
  assert.equal(r.atingidos, 3, "os três à frente");
  for (const m of [atras, lado, longe]) assert.equal(m.vida, m.vidaMax);
});

test("Dispersão forte o bastante derruba o bando inteiro com um tiro", () => {
  const h = hab("dispersao"), j = { x: 200, y: 200, dir: "right" }, gob = monstros.find((m) => m.id === "goblin");
  const bando = [criarMonstro(gob, 290, 200), criarMonstro(gob, 300, 225), criarMonstro(gob, 305, 180)];
  const r = atingir(j, bando, h, gob.vida / h.mult + 0.1, 0);
  assert.equal(r.mortos.length, 3);
});

test("Disparo (linha com 1 alvo) acerta só o primeiro da fila; Chuva acerta à distância e não perto", () => {
  const j = { x: 200, y: 200, dir: "right" };
  const a = criarMonstro(monstros[0], 260, 200), b = criarMonstro(monstros[0], 300, 200);
  const r = atingir(j, [b, a], hab("disparo"), 5, 0);
  assert.equal(r.atingidos, 1); assert.ok(a.vida < a.vidaMax); assert.equal(b.vida, b.vidaMax);
  const chuva = hab("chuva"), perto = criarMonstro(monstros[0], 215, 200), la = criarMonstro(monstros[0], 200 + chuva.distancia, 214);
  assert.equal(dentroDaArea(j, perto, chuva), false);
  assert.equal(dentroDaArea(j, la, chuva), true);
});

test("arqueiro: começa com Disparo e arco; save aceita arqueiro e recusa arco vestido por guerreiro", () => {
  const e = novoEstadoBase(P, I, "arqueiro", "disparo");
  assert.deepEqual(e.habilidades, { disparo: 1 });
  assert.equal(e.equip.arma.base, "arco-simples");
  const s = memoria(); s.setItem("valdor-save", serializar(e));
  assert.ok(carregar(s, mapasValidos), "arqueiro carrega");
  const g = novoEstado(); g.equip.arma = { base: "arco-simples", qual: "comum", mais: 0, bonus: {} };
  s.setItem("valdor-save", serializar(g));
  assert.equal(carregar(s, mapasValidos), null, "guerreiro com arco é inválido");
  const x = novoEstado(); x.classe = "mago"; s.setItem("valdor-save", serializar(x));
  assert.equal(carregar(s, mapasValidos), null, "classe inexistente");
});

test("ritmo do arqueiro: nível 10 em cerca de 30 minutos, como o guerreiro", () => {
  const m = media(10, 20, { classe: "arqueiro" });
  assert.ok(m.minutos >= 25 && m.minutos <= 35, `${m.minutos.toFixed(1)} min`);
});

test("área da habilidade cresce com o grau (alcance, raio e ângulo), sem mudar o dano", () => {
  const d1 = escalarArea(hab("dispersao"), H.por_grau, 1), d5 = escalarArea(hab("dispersao"), H.por_grau, 5);
  assert.ok(d5.alcance > d1.alcance && d5.angulo > d1.angulo && d5.angulo <= 170);
  assert.equal(d5.mult, d1.mult);
  const j = { x: 200, y: 200, dir: "right" }, m = criarMonstro(monstros[0], 200 + d1.alcance + 20, 200);
  assert.equal(dentroDaArea(j, m, d1), false); assert.equal(dentroDaArea(j, m, d5), true, "grau 5 alcança mais longe");
  const g5 = escalarArea(hab("giro"), H.por_grau, 5); assert.ok(g5.raio > hab("giro").raio);
  assert.deepEqual(escalarArea(hab("golpe"), H.por_grau, 1), hab("golpe"));
});

test("Poder sobe com pontos de atributo e com item melhor; ataques/s sobe com Agilidade", () => {
  const e = novoEstado(), base = estatisticas(P, derivados(P, I, e), hab("golpe"));
  e.atributos.for += 3; const forca = estatisticas(P, derivados(P, I, e), hab("golpe"));
  assert.ok(forca.poder > base.poder);
  e.equip.peitoral = novoItem("armadura-placa", "lendario", 3); const item = estatisticas(P, derivados(P, I, e), hab("golpe"));
  assert.ok(item.poder > forca.poder);
  e.atributos.agi += 5; const agi = estatisticas(P, derivados(P, I, e), hab("golpe"));
  assert.ok(agi.ataquesPorSeg > item.ataquesPorSeg && agi.dps > item.dps);
});

test("novas habilidades: Perfurante atravessa a fila; Rajada sai em 3 flechas de 1 alvo; Terremoto alcança mais que o Giro; Investida avança", () => {
  const j = { x: 200, y: 200, dir: "right" }, fila = [260, 320, 400].map((x) => criarMonstro(monstros[0], x, 200));
  assert.equal(atingir(j, fila, hab("perfurante"), 5, 0).atingidos, 3, "perfura todos na linha");
  const raj = hab("rajada"); assert.equal(raj.alvos, 1); assert.ok(raj.repeticoes >= 3);
  const longe = criarMonstro(monstros[0], 200 + hab("giro").raio + 20, 200);
  assert.equal(dentroDaArea(j, longe, hab("giro")), false); assert.equal(dentroDaArea(j, longe, hab("terremoto")), true);
  assert.ok(hab("investida").avanco > 0);
  for (const c of C) for (const id of c.habilidades) { const h = hab(id); assert.ok(h && h.classe === c.id && h.nivel <= P.nivel_max, id); }
});

test("ritmo das regiões 2 e 3: 10→20 leva cerca de 2 h e 20→29 cerca de 4 h (bem mais lento que 1→10)", () => {
  for (const classe of ["guerreiro", "arqueiro"]) {
    const m = media(29, 8, { classe }), r2 = m.marcos[20] - m.marcos[10], r3 = m.marcos[29] - m.marcos[20];
    assert.ok(r2 >= 90 && r2 <= 150, `${classe} 10→20: ${r2.toFixed(0)} min`);
    assert.ok(r3 >= 180 && r3 <= 300, `${classe} 20→29: ${r3.toFixed(0)} min`);
    assert.ok(m.mortes / (m.minutos / 60) < 4, `${classe}: ${m.mortes} mortes em ${m.minutos.toFixed(0)} min`);
  }
});

test("recuperação de vida: cresce com Vitalidade e com a vida máxima; zero sem a regra", () => {
  const e = novoEstado(), r0 = derivados(P, I, e).regen;
  assert.ok(r0 > 0);
  e.atributos.vit += 10; const r1 = derivados(P, I, e).regen; assert.ok(r1 > r0, `${r0} → ${r1}`);
  const sv = derivados(P, I, e), seg = (sv.vidaMax * 0.4) / sv.regen;
  assert.ok(seg >= 10 && seg <= 40, `de 60% a 100% em ${seg.toFixed(0)} s`);
  assert.equal(derivados({ ...P, regeneracao: undefined }, I, e).regen, 0);
});
