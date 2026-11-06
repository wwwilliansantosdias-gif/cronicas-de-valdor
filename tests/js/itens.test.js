import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sortearDrop, sortearQualidade, multSorte, nomeItem, precoVenda, pegar, equipar, desequipar, descartar, vender, impedimento } from "../../docs/src/itens.js";
import { novoEstado } from "../../docs/src/progresso.js";
import { novoItem, derivados } from "../../docs/src/personagem.js";
import { validar, migrarV4, VERSAO } from "../../docs/src/salvar.js";
import { criarPrng } from "../../docs/src/prng.js";

const ler = (f) => JSON.parse(readFileSync(new URL("../../docs/" + f, import.meta.url), "utf8"));
const P = ler("dados/progressao.json"), I = ler("dados/itens.json"), M = ler("dados/monstros.json").monstros;
const comum = M.find((m) => m.comportamento === "inimigo"), chefe = M.find((m) => m.comportamento === "chefe");
const N = 20000;

test("taxa de queda de monstro comum fica perto da configurada", () => {
  const rng = criarPrng(3), e = novoEstado(P, I);
  let n = 0; for (let i = 0; i < N; i++) if (sortearDrop(I, P, comum, e, 9, 5, rng)) n++;
  const taxa = n / N;
  assert.ok(Math.abs(taxa - I.drops.chance) < 0.01, `taxa ${taxa}`);
});

test("chefe sempre larga, sempre Raro ou melhor, com bônus de atributo", () => {
  const rng = criarPrng(4), e = novoEstado(P, I), ordem = I.qualidades.map((q) => q.id);
  for (let i = 0; i < 2000; i++) {
    const it = sortearDrop(I, P, chefe, e, 9, 5, rng);
    assert.ok(it);
    assert.ok(ordem.indexOf(it.qual) >= ordem.indexOf(I.drops.chefe_qualidade_min));
    assert.ok(Object.values(it.bonus).reduce((s, n) => s + n, 0) > 0);
  }
});

test("sem Sorte as qualidades seguem os pesos; Sorte aumenta as melhores com retorno decrescente", () => {
  const prop = (sor) => { const rng = criarPrng(9); let boas = 0; for (let i = 0; i < N; i++) if (sortearQualidade(I, sor, rng) !== "comum") boas++; return boas / N; };
  const total = I.qualidades.reduce((s, q) => s + q.peso, 0), esperado = 1 - I.qualidades[0].peso / total;
  const p0 = prop(0), p20 = prop(20), p100 = prop(100), p1000 = prop(1000);
  assert.ok(Math.abs(p0 - esperado) < 0.015, `${p0} vs ${esperado}`);
  assert.ok(p20 > p0 && p100 > p20 && p1000 > p100);
  assert.ok(multSorte(I, 1e9) <= I.drops.sorte_mult_max + 1e-9);
  assert.ok(multSorte(I, 20) - multSorte(I, 0) > multSorte(I, 120) - multSorte(I, 100), "retorno decrescente");
});

test("só caem itens da classe e até o nível da região", () => {
  const rng = criarPrng(5), e = novoEstado(P, I);
  for (let i = 0; i < 3000; i++) { const it = sortearDrop(I, P, chefe, e, 9, 0, rng); const b = I.itens.find((x) => x.id === it.base); assert.ok(b.tipo !== "consumivel" && b.classes.includes("guerreiro") && (b.nivel || 1) <= 9); }
});

test("só cai item de até 2 níveis acima do jogador, e nunca acima da região", () => {
  const rng = criarPrng(8), e = novoEstado(P, I);
  const nivelBase = (it) => I.itens.find((x) => x.id === it.base).nivel || 1;
  for (const nv of [1, 4, 9]) { e.nivel = nv; for (let i = 0; i < 2000; i++) { const it = sortearDrop(I, P, chefe, e, 9, 0, rng); assert.ok(nivelBase(it) <= Math.min(9, nv + I.drops.acima_do_nivel), `nível ${nv}: ${it.base}`); } }
  e.nivel = 1; const vistos = new Set(); for (let i = 0; i < 3000; i++) vistos.add(sortearDrop(I, P, chefe, e, 9, 0, rng).base);
  assert.ok(vistos.size >= 4, "variedade no começo: " + [...vistos]);
});

test("equipar troca com o item vestido, que volta para a mochila no mesmo lugar", () => {
  const e = novoEstado(P, I), velho = e.equip.arma, novo = novoItem("espada-longa", "raro", 0, { for: 2 });
  e.mochila.push(novoItem("elmo-armet"), novo);
  const antes = derivados(P, I, e).dano;
  assert.ok(equipar(I, e, 1));
  assert.equal(e.equip.arma, novo); assert.equal(e.mochila[1], velho); assert.equal(e.mochila.length, 2);
  assert.ok(derivados(P, I, e).dano > antes);
});

test("não equipa item de nível maior, de outra classe ou consumível", () => {
  const e = novoEstado(P, I);
  const I2 = { ...I, itens: [...I.itens, { id: "machado-teste", tipo: "arma", espaco: "arma", nivel: 15, classes: ["guerreiro"], dano: 9 }, { id: "arco-teste", tipo: "arma", espaco: "arma", nivel: 1, classes: ["arqueiro"], dano: 5 }] };
  assert.match(impedimento(I2, e, novoItem("machado-teste")), /nível 15/);
  assert.match(impedimento(I2, e, novoItem("arco-teste")), /classe/);
  e.mochila.push(novoItem("machado-teste"));
  assert.equal(equipar(I2, e, 0), false);
});

test("mochila cheia recusa item novo; desequipar com mochila cheia é recusado", () => {
  const e = novoEstado(P, I);
  for (let i = 0; i < I.mochila_max; i++) assert.ok(pegar(I, e, novoItem("elmo-armet")));
  assert.equal(pegar(I, e, novoItem("elmo-armet")), false);
  assert.equal(desequipar(I, e, "arma"), false);
  descartar(e, 0);
  assert.ok(desequipar(I, e, "arma")); assert.equal(e.equip.arma, null);
});

test("vender dá ouro e tira o item; qualidade e +N valem mais", () => {
  const e = novoEstado(P, I);
  const c = novoItem("espada-longa"), r = novoItem("espada-longa", "raro", 0, { for: 2 }), m = novoItem("espada-longa", "comum", 3);
  assert.ok(precoVenda(I, r) > precoVenda(I, c)); assert.ok(precoVenda(I, m) > precoVenda(I, c));
  e.mochila.push(r); const v = vender(I, e, 0);
  assert.equal(e.ouro, v); assert.equal(e.mochila.length, 0);
  assert.equal(nomeItem(I, novoItem("espada-longa", "raro", 2)), "Espada longa Raro +2");
  assert.equal(nomeItem(I, c), "Espada longa");
});

test("save recusa item com bônus de atributo inexistente ou fora da faixa, e aceita item válido", () => {
  const mapas = ["pe-de-lenha", "mata-do-javali"];
  const base = () => JSON.parse(JSON.stringify(novoEstado(P, I)));
  const ok = base(); ok.mochila.push(novoItem("espada-longa", "raro", 0, { for: 2 }));
  assert.ok(validar(P, I, ok, mapas));
  for (const bonus of [{ xyz: 2 }, { for: 0 }, { for: 1.5 }]) { const e = base(); e.mochila.push(novoItem("espada-longa", "raro", 0, bonus)); assert.equal(validar(P, I, e, mapas), null, JSON.stringify(bonus)); }
  const cons = base(); cons.mochila.push(novoItem("pocao")); assert.equal(validar(P, I, cons, mapas), null, "poção não vai para a mochila de equipamento");
});

import { melhorar, proximaMelhoria, sortearFragmentos } from "../../docs/src/itens.js";

test("ferreiro: +1 e +2 sempre dão certo; custo cobrado; +N aumenta os valores do item", () => {
  const e = novoEstado(P, I); e.ouro = 1000; e.fragmentos = 10;
  const dano0 = derivados(P, I, e).dano;
  const r1 = melhorar(I, e, { espaco: "arma" }, () => 0.99), r2 = melhorar(I, e, { espaco: "arma" }, () => 0.99);
  assert.ok(r1.sucesso && r2.sucesso); assert.equal(e.equip.arma.mais, 2);
  assert.equal(e.ouro, 1000 - I.melhoria.custo_ouro[0] - I.melhoria.custo_ouro[1]);
  assert.equal(e.fragmentos, 10 - I.melhoria.fragmentos[0] - I.melhoria.fragmentos[1]);
  assert.ok(derivados(P, I, e).dano > dano0);
});

test("ferreiro: falha cobra o custo e o item continua igual (nunca quebra nem perde +N)", () => {
  const e = novoEstado(P, I); e.ouro = 10000; e.fragmentos = 100; e.equip.arma.mais = 2;
  const antes = JSON.stringify(e.equip.arma), ouro0 = e.ouro;
  const r = melhorar(I, e, { espaco: "arma" }, () => 0.999);
  assert.ok(r.feito && !r.sucesso);
  assert.equal(JSON.stringify(e.equip.arma), antes);
  assert.equal(e.ouro, ouro0 - I.melhoria.custo_ouro[2]);
});

test("ferreiro: taxa de sucesso medida bate com a tabela em cada nível", () => {
  const rng = criarPrng(11);
  for (let n = 0; n < I.melhoria.max; n++) {
    let ok = 0; const T = 4000;
    for (let k = 0; k < T; k++) { const e = novoEstado(P, I); e.ouro = 1e6; e.fragmentos = 1e6; e.equip.arma.mais = n; if (melhorar(I, e, { espaco: "arma" }, rng).sucesso) ok++; }
    assert.ok(Math.abs(ok / T - I.melhoria.chance[n]) < 0.03, `+${n}: ${ok / T} vs ${I.melhoria.chance[n]}`);
  }
});

test("ferreiro: recusa sem ouro, sem fragmentos ou no máximo, sem cobrar nada", () => {
  const e = novoEstado(P, I); e.ouro = 0; e.fragmentos = 0;
  assert.equal(melhorar(I, e, { espaco: "arma" }).motivo, "ouro insuficiente");
  e.ouro = 1000; e.equip.arma.mais = 2;
  assert.equal(melhorar(I, e, { espaco: "arma" }).motivo, "fragmentos insuficientes");
  assert.equal(e.ouro, 1000);
  e.equip.arma.mais = I.melhoria.max; e.fragmentos = 99;
  assert.equal(proximaMelhoria(I, e.equip.arma), null);
  assert.equal(melhorar(I, e, { espaco: "arma" }).motivo, "já está no máximo");
  e.mochila.push(novoItem("adaga")); e.ouro = 1000;
  assert.ok(melhorar(I, e, { i: 0 }, () => 0).sucesso, "melhora item da mochila também");
});

test("fragmentos: comum com a chance configurada; chefe sempre dá vários", () => {
  const rng = criarPrng(12); let n = 0;
  for (let i = 0; i < N; i++) n += sortearFragmentos(I, comum, rng);
  assert.ok(Math.abs(n / N - I.drops.fragmento_chance) < 0.01);
  assert.equal(sortearFragmentos(I, chefe, rng), I.drops.fragmentos_chefe);
});

import { conjuntosAtivos } from "../../docs/src/personagem.js";
import { migrarV2 } from "../../docs/src/salvar.js";

test("conjunto: bônus por peças vestidas (2, 4, completo), cumulativos; personagem novo não começa com bônus", () => {
  const e = novoEstado(P, I);
  assert.equal(conjuntosAtivos(I, e.equip).length, 0, "equipamento inicial não é conjunto");
  const c = I.conjuntos.find((x) => x.id === "lenhador"), base = derivados(P, I, e);
  const vestir = (ids) => { for (const id of ids) { const b = I.itens.find((x) => x.id === id); e.equip[b.espaco] = novoItem(id); } };
  vestir(c.pecas.slice(0, 2));
  let a = conjuntosAtivos(I, e.equip).find((x) => x.conjunto.id === "lenhador");
  assert.deepEqual(a.ativos, [2]);
  vestir(c.pecas);
  a = conjuntosAtivos(I, e.equip).find((x) => x.conjunto.id === "lenhador");
  assert.ok(a.completo); assert.deepEqual(a.ativos, Object.keys(c.bonus).map(Number));
  const d = derivados(P, I, e);
  assert.ok(d.atributos.vit >= base.atributos.vit + c.bonus["2"].atributos.vit);
});

test("todo conjunto aponta para itens que existem, de qualidade/visual próprios, e cada peça é de um espaço diferente", () => {
  for (const c of I.conjuntos) {
    const esp = c.pecas.map((id) => { const b = I.itens.find((x) => x.id === id); assert.ok(b, `${c.id}: ${id}`); return b.espaco; });
    assert.equal(new Set(esp).size, esp.length, c.id + " repete espaço");
    assert.ok(Object.keys(c.bonus).every((k) => +k <= c.pecas.length));
  }
});

test("save v2 vira v3 com os espaços novos vazios, sem perder o que estava vestido", () => {
  const v2 = { ...novoEstado(P, I), versao: 2 }; delete v2.equip.ombros; delete v2.equip.capa; delete v2.equip.escudo;
  const v3 = migrarV2(I, v2);
  assert.equal(v3.versao, 3);
  for (const e of I.espacos) assert.ok(e in v3.equip);
  assert.equal(v3.equip.ombros, null); assert.equal(v3.equip.arma.base, v2.equip.arma.base);
});

test("armas sem estocar ficam marcadas (a Estocada usa o golpe) e só existem para o guerreiro", () => {
  for (const it of I.itens.filter((x) => x.estocada_com_golpe)) { assert.ok(!it.visual.thrust); assert.ok(it.visual.slash); assert.deepEqual(it.classes, ["guerreiro"]); }
});

test("região 2 e 3 largam mais itens e de qualidade melhor que a Floresta", () => {
  const R = ler("dados/regioes.json").regioes, e = novoEstado(P, I); e.nivel = 20;
  const medir = (reg) => { const rng = criarPrng(11); let n = 0, boas = 0; for (let i = 0; i < N; i++) { const it = sortearDrop(I, P, comum, e, reg.niveis[1], 0, rng, reg.drops); if (it) { n++; if (it.qual !== "comum") boas++; } } return { taxa: n / N, boas: boas / n }; };
  const [f, c, r] = ["floresta", "caverna", "ruinas"].map((id) => medir(R.find((x) => x.id === id)));
  assert.ok(Math.abs(c.taxa - R[1].drops.chance) < 0.01 && c.taxa > f.taxa * 1.3 && r.taxa > c.taxa, JSON.stringify({ f, c, r }));
  assert.ok(c.boas > f.boas * 1.2 && r.boas > c.boas, JSON.stringify({ f, c, r }));
});

test("mago: cajados e chapéus só para o mago; armaduras leves e pesadas servem; drop do mago só traz cajado como arma", () => {
  const cajados = I.itens.filter((b) => b.id.startsWith("cajado-")), chapeus = I.itens.filter((b) => b.id.startsWith("chapeu-"));
  assert.ok(cajados.length >= 5 && chapeus.length >= 4);
  for (const b of [...cajados, ...chapeus]) assert.deepEqual(b.classes, ["mago"]);
  assert.ok(I.itens.find((b) => b.id === "gibao-couro").classes.includes("mago"));
  const e = novoEstado(P, I, "mago", "faisca"); e.nivel = 29; const rng = criarPrng(21);
  for (let i = 0; i < 2000; i++) { const it = sortearDrop(I, P, chefe, e, 29, 0, rng); const b = I.itens.find((x) => x.id === it.base); assert.ok(b.classes.includes("mago"), b.id); if (b.espaco === "arma") assert.ok(b.id.startsWith("cajado-")); }
  const g = novoEstado(P, I); g.equip.arma = novoItem("cajado-retorcido");
  assert.equal(validar(P, I, JSON.parse(JSON.stringify(g)), ["pe-de-lenha"]), null, "guerreiro com cajado é inválido");
});

// ---------- etapa 12: raridades, forja até +12, save v5 ----------
test("5 raridades: sem Sorte cada uma cai na proporção do peso; Lendário é a mais rara", () => {
  const rng = criarPrng(31), T = 200000, n = {};
  for (let i = 0; i < T; i++) { const q = sortearQualidade(I, 0, rng); n[q] = (n[q] || 0) + 1; }
  const total = I.qualidades.reduce((s, q) => s + q.peso, 0);
  for (const q of I.qualidades) assert.ok(Math.abs((n[q.id] || 0) / T - q.peso / total) < 0.004, `${q.id}: ${(n[q.id] || 0) / T}`);
  assert.ok(n.lendario < n.epico && n.epico < n.raro);
});

test("forja até +12: do +5 ao +12 a chance cai, o custo sobe e o valor do item continua subindo 10% por nível", () => {
  const e = novoEstado(P, I); e.ouro = 1e7; e.fragmentos = 1e6; e.equip.arma.mais = 11;
  const r = melhorar(I, e, { espaco: "arma" }, () => 0); assert.ok(r.sucesso); assert.equal(e.equip.arma.mais, 12);
  assert.equal(proximaMelhoria(I, e.equip.arma), null, "+12 é o máximo");
  const v = (m) => derivados(P, I, { ...e, equip: { ...e.equip, arma: { ...e.equip.arma, mais: m } } }).dano;
  assert.ok(v(12) > v(11) && v(11) > v(5));
});

test("save v4 vira v5: Refinado vira Incomum, Lendário continua Lendário, encaixes novos vazios, nada se perde", () => {
  const e = novoEstado(P, I); delete e.equip.sobre_peito; delete e.equip.pescoco;
  e.equip.peitoral = { base: "gibao-couro", qual: "refinado", mais: 3, bonus: {} };
  e.equip.arma = { base: "espada-longa", qual: "lendario", mais: 5, bonus: { for: 2, sor: 2 } };
  e.mochila = [{ base: "luvas", qual: "refinado", mais: 0, bonus: {} }, { base: "capuz", qual: "raro", mais: 1, bonus: { vit: 2 } }];
  const v4 = JSON.parse(JSON.stringify({ ...e, versao: 4 })), v5 = validar(P, I, migrarV4(I, v4), ["pe-de-lenha"]);
  assert.ok(v5); assert.equal(v5.versao, VERSAO); assert.equal(VERSAO, 5);
  assert.equal(v5.equip.peitoral.qual, "incomum"); assert.equal(v5.equip.peitoral.mais, 3);
  assert.equal(v5.equip.arma.qual, "lendario"); assert.deepEqual(v5.equip.arma.bonus, { for: 2, sor: 2 });
  assert.deepEqual(v5.mochila.map((it) => it.qual), ["incomum", "raro"]);
  assert.equal(v5.equip.sobre_peito, null); assert.equal(v5.equip.pescoco, null);
  // o Lendário não muda de força na conversão
  assert.equal(I.qualidades.find((q) => q.id === "lendario").mult, 1.6);
  // +12 é válido, +13 não
  const x = JSON.parse(JSON.stringify(v5)); x.equip.arma.mais = 12; assert.ok(validar(P, I, x, ["pe-de-lenha"]));
  const y = JSON.parse(JSON.stringify(v5)); y.equip.arma.mais = 13; assert.equal(validar(P, I, y, ["pe-de-lenha"]), null);
});

test("itens novos: tabardo só para o guerreiro, amuletos para todas as classes, com números", () => {
  const t = I.itens.find((x) => x.id === "tabardo-vermelho"), a = I.itens.find((x) => x.id === "amuleto-estrela");
  assert.deepEqual(t.classes, ["guerreiro"]); assert.deepEqual(a.classes, ["guerreiro", "arqueiro", "mago"]);
  for (const it of I.itens.filter((x) => x.tipo !== "consumivel")) assert.ok((it.dano || it.vida || it.defesa) > 0 && it.nivel >= 1 && it.preco > 0, it.id);
  const g = novoEstado(P, I, "arqueiro", "disparo"); g.mochila = [novoItem("tabardo-vermelho")];
  assert.ok(impedimento(I, g, g.mochila[0]), "arqueiro não veste tabardo");
});
