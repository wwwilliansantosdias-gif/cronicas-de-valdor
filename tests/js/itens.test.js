import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sortearDrop, sortearQualidade, multSorte, nomeItem, precoVenda, pegar, equipar, desequipar, descartar, vender, impedimento } from "../../docs/src/itens.js";
import { novoEstado } from "../../docs/src/progresso.js";
import { novoItem, derivados } from "../../docs/src/personagem.js";
import { validar } from "../../docs/src/salvar.js";
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
  const I2 = { ...I, itens: [...I.itens, { id: "machado", tipo: "arma", espaco: "arma", nivel: 15, classes: ["guerreiro"], dano: 9 }, { id: "arco", tipo: "arma", espaco: "arma", nivel: 1, classes: ["arqueiro"], dano: 5 }] };
  assert.match(impedimento(I2, e, novoItem("machado")), /nível 15/);
  assert.match(impedimento(I2, e, novoItem("arco")), /classe/);
  e.mochila.push(novoItem("machado"));
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
