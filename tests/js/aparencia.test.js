import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPOS, opcoes, normalizar, alternar, aleatoria, pares, recolorir } from "../../docs/src/aparencia.js";
import { carregar, serializar } from "../../docs/src/salvar.js";
import { novoEstado } from "../../docs/src/progresso.js";
import { criarPrng } from "../../docs/src/prng.js";

const ler = (f) => JSON.parse(readFileSync(new URL("../../docs/" + f, import.meta.url), "utf8"));
const AP = ler("dados/aparencia.json"), P = ler("dados/progressao.json"), I = ler("dados/itens.json");
const mapas = Object.keys(ler("dados/regioes.json").mapas);
function memoria() { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; }

test("padrão e todas as opções são válidos; peças existem em docs/assets/pecas para as animações das classes", () => {
  assert.deepEqual(normalizar(AP, AP.padrao), AP.padrao);
  const anims = new Set(Object.values(I.corpo).flatMap((c) => c.animacoes));
  for (const c of ["rosto", "cabelo", "barba"]) for (const o of opcoes(AP, c)) if (o.pasta)
    for (const a of anims) assert.ok(readFileSync(new URL(`../../docs/assets/pecas/${o.pasta}/${a}.png`, import.meta.url)).length > 0, `${o.pasta}/${a}`);
  for (const c of ["pele", "cor_cabelo", "olhos"]) { assert.ok(AP[c].opcoes.some((o) => o.id === AP[c].base) || AP[c].base_cores.length, c); for (const o of AP[c].opcoes) assert.equal(o.cores.length, AP[c].base_cores.length, o.id); }
});

test("normalizar: campo ausente ou id desconhecido vira o padrão, o resto fica", () => {
  const a = normalizar(AP, { pele: "brown", cabelo: "inexistente" });
  assert.equal(a.pele, "brown"); assert.equal(a.cabelo, AP.padrao.cabelo); assert.equal(a.barba, AP.padrao.barba);
  assert.deepEqual(normalizar(AP, null), AP.padrao);
});

test("alternar dá a volta nos dois sentidos; aleatória só sorteia opções que existem", () => {
  const ops = opcoes(AP, "cabelo"); let a = { ...AP.padrao, cabelo: ops[0].id };
  assert.equal(alternar(AP, a, "cabelo", -1).cabelo, ops.at(-1).id);
  for (let i = 0; i < ops.length; i++) a = alternar(AP, a, "cabelo", 1);
  assert.equal(a.cabelo, ops[0].id);
  const rng = criarPrng(7);
  for (let i = 0; i < 200; i++) { const r = aleatoria(AP, rng); assert.deepEqual(normalizar(AP, r), r); }
});

test("troca de paleta: cor da base vira a cor escolhida (±1), outras cores e transparência ficam", () => {
  const tr = pares(AP, "pele", "brown"), [de, para] = tr[2];
  const px = new Uint8ClampedArray([de[0] + 1, de[1], de[2] - 1, 255, 10, 200, 30, 255, de[0], de[1], de[2], 0]);
  recolorir(px, tr);
  assert.deepEqual([...px.slice(0, 3)], para);
  assert.deepEqual([...px.slice(4, 7)], [10, 200, 30]);
  assert.deepEqual([...px.slice(8, 11)], de, "pixel transparente não muda");
  assert.equal(pares(AP, "pele", AP.pele.base).length, 0);
});

test("save: v3 vira v4 com aparência padrão; aparência adulterada não derruba o save", () => {
  const s = memoria(), v3 = { ...novoEstado(P, I), versao: 3 }; delete v3.aparencia;
  s.setItem("valdor-save", serializar(v3));
  const e = carregar(P, I, s, mapas);
  assert.equal(e.versao, 4); assert.equal(e.aparencia, null); assert.equal(e.nivel, 1);
  const x = novoEstado(P, I, "guerreiro", "golpe", { pele: { mal: 1 } }); s.setItem("valdor-save", serializar(x));
  const y = carregar(P, I, s, mapas); assert.ok(y); assert.equal(y.aparencia, null);
  const z = novoEstado(P, I, "arqueiro", "disparo", { ...AP.padrao, pele: "black" }); s.setItem("valdor-save", serializar(z));
  assert.equal(carregar(P, I, s, mapas).aparencia.pele, "black");
  for (const c of CAMPOS) assert.ok(c in AP.padrao);
});
