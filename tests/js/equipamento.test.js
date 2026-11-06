// Sistema de equipamentos da etapa 11 (documentacao/etapa-11-equipamentos-lpc.md): camadas por zPos, cor por paleta,
// memória das imagens recoloridas, raridade, efeitos, encaixes e créditos. Usa os dados reais de docs/dados.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dados, raridade, ordemRaridades, corDaParte, camadasDoItem, camadasDoPersonagem, ordenarPorZ, podeEquipar,
  efeitos, creditosDoCatalogo, CacheRecolor, chaveRecolor, estocadaUsaGolpe } from "../../docs/src/equipamento.js";
import { recolorir } from "../../docs/src/aparencia.js";

const ler = (f) => JSON.parse(readFileSync(new URL("../../docs/dados/" + f, import.meta.url), "utf8"));
const D = dados({ defs: ler("lpc_definicoes.json"), catalogo: ler("itens.json"), raridades: ler("raridades.json") });
const R = D.raridades;
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test("ordem das camadas: arco atrás e na frente do corpo; capa atrás e na frente; elmo por cima do cabelo", () => {
  const equip = { arma: { item: "arco-simples", raridade: "comum", reforco: 0 }, capa: { item: "capa-lisa", raridade: "comum", reforco: 0 },
    capacete: { item: "elmo-nasal", raridade: "comum", reforco: 0 }, peitoral: { item: "gibao-couro", raridade: "comum", reforco: 0 } };
  const L = camadasDoPersonagem(D, "arqueiro", equip, "shoot");
  const zs = L.map((c) => c.z); assert.deepEqual(zs, [...zs].sort((a, b) => a - b), "desenho do menor zPos para o maior");
  const idx = (pred) => L.findIndex(pred), corpo = idx((c) => c.parte === "body/body");
  assert.ok(idx((c) => c.item === "arco-simples" && c.z < 0) < corpo, "parte de trás do arco antes do corpo");
  assert.ok(idx((c) => c.item === "arco-simples" && c.z >= 140) > idx((c) => c.parte === "head/heads/human/heads_human_male"), "frente do arco depois da cabeça");
  assert.ok(idx((c) => c.item === "capa-lisa" && c.z < 10) < corpo && idx((c) => c.item === "capa-lisa" && c.z > 60) > idx((c) => c.item === "gibao-couro"));
  assert.ok(idx((c) => c.item === "elmo-nasal") > idx((c) => c.parte === "hair/short/hair_plain"));
  // trocar um item troca só as camadas dele
  const L2 = camadasDoPersonagem(D, "arqueiro", { ...equip, arma: { item: "arco-longo", raridade: "comum", reforco: 0 } }, "shoot");
  assert.deepEqual(L2.filter((c) => c.item !== "arco-longo").map((c) => c.arquivo), L.filter((c) => c.item !== "arco-simples").map((c) => c.arquivo));
  // ordenação estável: mesmo zPos mantém a ordem de chegada
  assert.deepEqual(ordenarPorZ([{ z: 5, n: 1 }, { z: 1, n: 2 }, { z: 5, n: 3 }]).map((c) => c.n), [2, 1, 3]);
});

test("quadros maiores que 64 px: arco andando usa walk_128; armas grandes do guerreiro usam 192", () => {
  assert.ok(camadasDoItem(D, "arco-simples", "walk", "comum").every((c) => c.tamanho === 128));
  assert.ok(camadasDoItem(D, "arco-simples", "shoot", "comum").every((c) => c.tamanho === 64));
  assert.ok(camadasDoItem(D, "espada-longa", "slash", "comum").some((c) => c.tamanho === 192));
});

test("cor pela paleta: item com recolors troca a paleta-base pela da raridade; cores próprias do Valdor também", () => {
  assert.equal(corDaParte(D, "elmo-nasal", 0, "epico"), "metal.gold");
  const [c] = camadasDoItem(D, "elmo-nasal", "walk", "epico");
  assert.ok(c.arquivo.endsWith("walk.png") && c.trocas.length === 6);
  assert.deepEqual(c.trocas[5], [hx(D.defs.paletas.metal.cores.steel[5]), hx(D.defs.paletas.metal.cores.gold[5])]);
  const lend = camadasDoItem(D, "elmo-nasal", "walk", "lendario")[0];
  assert.deepEqual(lend.trocas[0][1], hx(D.defs.paletas.valdor.cores.ouro_fogo[0]), "Lendário usa o dourado-fogo do Valdor");
  const comum = camadasDoItem(D, "capuz", "walk", "lendario")[0];
  assert.deepEqual(comum.trocas[0][1], hx(D.defs.paletas.cloth.cores.forest[0]), "pano tem cor fixa, não muda com a raridade");
  // troca de verdade nos pixels, com tolerância de ±1 por canal
  const [de, para] = c.trocas[2], px = new Uint8ClampedArray([de[0] + 1, de[1] - 1, de[2], 255, 1, 2, 3, 255]);
  recolorir(px, c.trocas); assert.deepEqual([...px.slice(0, 3)], para); assert.deepEqual([...px.slice(4, 7)], [1, 2, 3]);
});

test("arco (só variantes prontas): ouro e prata usam a imagem pronta; madeira e Valdor trocam a paleta da base", () => {
  const ouro = camadasDoItem(D, "arco-simples", "shoot", "epico");
  assert.ok(ouro.every((c) => c.arquivo.endsWith("/gold.png") && c.trocas.length === 0));
  const madeira = camadasDoItem(D, "arco-simples", "shoot", "comum");
  assert.ok(madeira.every((c) => c.arquivo.endsWith("/normal.png") && c.trocas.length === 6));
  assert.deepEqual(madeira[0].trocas[0], [hx(D.defs.paletas.wood.cores.maple[0]), hx(D.defs.paletas.wood.cores.oak[0])]);
  const fogo = camadasDoItem(D, "arco-longo", "walk", "lendario");
  assert.ok(fogo.every((c) => c.trocas.length === 6) && fogo[0].trocas[3][1].join() === hx(D.defs.paletas.valdor.cores.ouro_fogo[3]).join());
  // espada longa: a base não está em nenhuma paleta, então fica com a cor original (limite da arte, só os efeitos mudam)
  assert.ok(camadasDoItem(D, "espada-longa", "walk", "lendario").every((c) => c.trocas.length === 0));
});

test("memória das imagens recoloridas: mesma imagem e cor é feita uma vez; outra cor gera outra", () => {
  let feitas = 0; const cache = new CacheRecolor((arquivo, trocas) => { feitas++; return { arquivo, n: trocas.length }; });
  const a = camadasDoItem(D, "elmo-nasal", "walk", "epico")[0], b = camadasDoItem(D, "elmo-nasal", "walk", "raro")[0];
  const x1 = cache.obter(a.arquivo, a.trocas), x2 = cache.obter(a.arquivo, a.trocas);
  assert.equal(x1, x2); assert.equal(feitas, 1);
  cache.obter(b.arquivo, b.trocas); assert.equal(feitas, 2); assert.equal(cache.tamanho, 2);
  assert.notEqual(chaveRecolor(a.arquivo, a.trocas), chaveRecolor(b.arquivo, b.trocas));
  assert.equal(cache.obter(a.arquivo, []), null, "sem troca não guarda nada: usa a imagem original");
});

test("tabela de raridade: 5 níveis em ordem, nome e cor do nome; raridade desconhecida é recusada", () => {
  assert.deepEqual(ordemRaridades(R), ["comum", "incomum", "raro", "epico", "lendario"]);
  assert.equal(raridade(R, "lendario").nome, "Lendário"); assert.match(raridade(R, "raro").cor_nome, /^#[0-9a-f]{6}$/i);
  assert.throws(() => raridade(R, "mitico"));
});

test("efeitos: ligam pela raridade, crescem com o reforço até o limite e desligam pela chave", () => {
  const z = efeitos(R, "comum", 0); assert.ok(Object.values(z).every((v) => v === 0), "Comum +0 sem efeito");
  assert.ok(efeitos(R, "raro", 0).contorno > 0 && efeitos(R, "raro", 0).pulsar === 0);
  const ep = efeitos(R, "epico", 0); assert.ok(ep.pulsar > 0 && ep.clarao > 0 && ep.particulas === 0);
  const le = efeitos(R, "lendario", 0); assert.ok(le.particulas > 0 && le.rastro > 0 && le.aura > 0);
  // reforço: sobe a força, liga contorno (+4), partículas (+7) e aura (+10) em qualquer raridade
  assert.ok(efeitos(R, "comum", 4).contorno > 0 && efeitos(R, "comum", 3).contorno === 0);
  assert.ok(efeitos(R, "comum", 7).particulas > 0 && efeitos(R, "comum", 10).aura > 0);
  let ant = -1; for (let n = 0; n <= 12; n++) { const e = efeitos(R, "lendario", n); assert.ok(e.contorno >= ant && e.contorno <= 1); ant = e.contorno; }
  assert.ok(efeitos(R, "lendario", 12).qtdParticulas <= R.limites.particulas_max);
  assert.ok(efeitos(R, "lendario", 12).qtdParticulas > efeitos(R, "lendario", 0).qtdParticulas);
  assert.ok(Object.values(efeitos(R, "lendario", 12, false)).every((v) => v === 0), "chave desligada: nada");
  assert.throws(() => efeitos(R, "comum", 13)); assert.throws(() => efeitos(R, "comum", -1));
});

test("encaixes: item no encaixe errado ou na classe errada é recusado", () => {
  assert.equal(podeEquipar(D, "arco-simples", "arma", "arqueiro").ok, true);
  assert.equal(podeEquipar(D, "arco-simples", "escudo", "arqueiro").ok, false);
  assert.equal(podeEquipar(D, "arco-simples", "arma", "guerreiro").ok, false);
  assert.equal(podeEquipar(D, "tabardo-vermelho", "sobre_peito", "arqueiro").ok, false, "arqueiro não tem tabardo");
  assert.equal(podeEquipar(D, "escudo-reforcado", "escudo", "guerreiro").ok, true);
  assert.equal(podeEquipar(D, "escudo-reforcado", "arma", "guerreiro").ok, false, "classe certa, encaixe errado");
  assert.equal(podeEquipar(D, "luvas", "botas", "arqueiro").ok, false);
  assert.equal(podeEquipar(D, "nao-existe", "arma", "guerreiro").ok, false);
  assert.match(podeEquipar(D, "arco-simples", "arma", "guerreiro").motivo, /classe/);
});

test("itens: todo item vestível tem formato; besta fora; todo encaixe tem item para cada classe que pode usar; toda animação desenha", () => {
  const vestiveis = D.catalogo.itens.filter((it) => it.tipo !== "consumivel");
  for (const it of vestiveis) assert.ok(it.formato && it.formato.length, `${it.id} sem formato`);
  assert.ok(!vestiveis.some((it) => it.formato.some((p) => /crossbow|boomerang|slingshot/.test(p.def))));
  for (const [enc, e] of Object.entries(D.catalogo.encaixes)) for (const c of e.classes)
    assert.ok(vestiveis.some((it) => it.espaco === enc && it.classes.includes(c)), `${enc} sem item para ${c}`);
  for (const [c, anims] of Object.entries(D.catalogo.animacoes_classe)) for (const a of anims)
    for (const it of vestiveis.filter((x) => x.classes.includes(c))) assert.ok(camadasDoItem(D, it.id, a, "comum").length > 0, `${it.id} sem ${a}`);
});

test("créditos: cada formato usado tem autor, licença e link; formato sem crédito é recusado", () => {
  const cr = creditosDoCatalogo(D);
  const usados = new Set(Object.values(D.itens).flatMap((it) => it.formato.map((p) => p.def)));
  for (const f of usados) assert.ok(cr.some((c) => c.formato === f), f);
  assert.ok(cr.every((c) => c.autores.length && c.licencas.length && c.urls.length));
  const quebrado = dados({ ...D, defs: { ...D.defs, definicoes: { ...D.defs.definicoes, "torso/cape/cape_solid": { ...D.defs.definicoes["torso/cape/cape_solid"], creditos: [] } } } });
  assert.throws(() => creditosDoCatalogo(quebrado));
});

test("aparência: rosto, cabelo e barba escolhidos entram como peças do gerador; sem barba não desenha barba", () => {
  const AP = ler("aparencia.json"), op = (c, id) => AP[c].find((o) => o.id === id).def;
  const ap = { pele: "body.brown", cabelo: "hair.black", defs: { rosto: op("rosto", "male_plump"), cabelo: op("cabelo", "afro"), barba: op("barba", "cheia") } };
  const L = camadasDoPersonagem(D, "guerreiro", {}, "walk", ap);
  for (const f of Object.values(ap.defs)) assert.ok(L.some((c) => c.parte === f), f);
  assert.ok(L.find((c) => c.parte === "body/body").trocas.length > 0, "pele trocada");
  const sem = camadasDoPersonagem(D, "guerreiro", {}, "walk", { defs: { rosto: op("rosto", "male"), cabelo: null, barba: null } });
  assert.equal(sem.filter((c) => /^hair\//.test(c.parte)).length, 0, "careca e sem barba");
});

test("estocada: armas sem estocada no LPC usam o golpe; as que têm, não", () => {
  assert.equal(estocadaUsaGolpe(D, "maca"), true); assert.equal(estocadaUsaGolpe(D, "espada-longa"), false);
  assert.ok(camadasDoItem(D, "maca", "thrust", "comum").every((c) => c.anim === "slash"));
});

test("conjuntos de região têm cor fixa (identidade); a raridade não muda a cor deles", () => {
  const I = D.catalogo, fixa = { mineiro: "metal.bronze", cinzaltar: "valdor.cinzaltar" };
  for (const [c, cor] of Object.entries(fixa)) for (const id of I.conjuntos.find((x) => x.id === c).pecas)
    assert.ok(D.itens[id].formato.every((p) => p.cor === cor), `${id} deveria ser ${cor}`);
  const a = camadasDoItem(D, "placas-cinzaltar", "walk", "comum")[0].trocas, b = camadasDoItem(D, "placas-cinzaltar", "walk", "lendario")[0].trocas;
  assert.deepEqual(a, b);
});
