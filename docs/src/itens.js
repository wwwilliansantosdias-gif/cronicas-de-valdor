// Itens: queda (drop), nome, preço de venda, pegar, equipar e descartar.
// Regras em dados/itens.json ("drops", "qualidades", "mochila_max"). Funções puras: testáveis sem navegador.
import { novoItem, baseItem, qualidade } from "./personagem.js";

// multiplicador da Sorte sobre os pesos das qualidades acima de Comum: cresce com retorno decrescente
// (sor/(sor+k)), como o "encontrar mágicos" do Diablo 2; nunca passa de sorte_mult_max
export function multSorte(I, sor) {
  const d = I.drops, f = sor / (sor + d.sorte_k);
  return 1 + (d.sorte_mult_max - 1) * f;
}

export function sortearQualidade(I, sor, rng, minimo = null, multRegiao = 1) {
  const ordem = I.qualidades.map((q) => q.id), iMin = minimo ? ordem.indexOf(minimo) : 0, m = multSorte(I, sor) * multRegiao;
  const opcoes = I.qualidades.filter((_, i) => i >= iMin).map((q) => ({ q, peso: q.id === "comum" ? q.peso : q.peso * m }));
  let r = rng() * opcoes.reduce((s, o) => s + o.peso, 0);
  for (const o of opcoes) { r -= o.peso; if (r <= 0) return o.q.id; }
  return opcoes.at(-1).q.id;
}

// bases que podem cair: equipáveis, da classe, até o nível máximo da região
export function basesQueCaem(I, classe, nivelMax) {
  return I.itens.filter((b) => b.tipo !== "consumivel" && (!b.classes || b.classes.includes(classe)) && (b.nivel || 1) <= nivelMax);
}

// sorteia o que um monstro derrubado larga (ou null): cai?, depois qual base, depois a qualidade e os bônus.
// Só cai item de até "acima_do_nivel" níveis acima do jogador (e nunca acima da região): nada de item inútil por muito tempo.
// regiao: { chance, qualidade_mult } da região (regioes.json "drops"): regiões novas largam mais e melhor
export function sortearDrop(I, P, def, est, nivelMaxRegiao, sor, rng, regiao = {}) {
  const d = I.drops, chefe = def.comportamento === "chefe";
  if (rng() >= (chefe ? d.chance_chefe : regiao.chance ?? d.chance)) return null;
  const bases = basesQueCaem(I, est.classe, Math.min(nivelMaxRegiao, est.nivel + d.acima_do_nivel));
  if (!bases.length) return null;
  const base = bases[Math.floor(rng() * bases.length)];
  const qual = sortearQualidade(I, sor, rng, chefe ? d.chefe_qualidade_min : null, regiao.qualidade_mult || 1);
  const bonus = {};
  for (let i = 0; i < qualidade(I, qual).bonus_atributos; i++) {
    const a = P.atributos[Math.floor(rng() * P.atributos.length)];
    bonus[a] = (bonus[a] || 0) + d.valor_bonus_atributo;
  }
  return novoItem(base.id, qual, 0, bonus);
}

export function nomeItem(I, it) {
  const b = baseItem(I, it.base), q = qualidade(I, it.qual);
  return `${b.nome}${it.qual === "comum" ? "" : " " + q.nome}${it.mais ? " +" + it.mais : ""}`;
}

export function precoVenda(I, it) {
  const b = baseItem(I, it.base), q = qualidade(I, it.qual);
  const extras = Object.values(it.bonus || {}).reduce((s, n) => s + n, 0);
  return Math.max(1, Math.round((b.preco || 10) * q.mult * (1 + 0.1 * it.mais) * (1 + 0.15 * extras) * I.drops.venda_fracao));
}

// põe na mochila; false se cheia
export function pegar(I, est, it) {
  if (est.mochila.length >= I.mochila_max) return false;
  est.mochila.push(it); return true;
}

// motivo pelo qual não pode equipar (ou null se pode)
export function impedimento(I, est, it) {
  const b = baseItem(I, it.base);
  if (!b || b.tipo === "consumivel") return "não é equipável";
  if (b.classes && !b.classes.includes(est.classe)) return "classe diferente";
  if ((b.nivel || 1) > est.nivel) return `exige nível ${b.nivel}`;
  return null;
}

// equipa o item da posição i da mochila; o que estava no espaço volta para a mochila no mesmo lugar
export function equipar(I, est, i) {
  const it = est.mochila[i];
  if (!it || impedimento(I, est, it)) return false;
  const espaco = baseItem(I, it.base).espaco, antigo = est.equip[espaco];
  est.equip[espaco] = it;
  if (antigo) est.mochila[i] = antigo; else est.mochila.splice(i, 1);
  return true;
}

// tira o item do espaço e guarda na mochila; false se a mochila estiver cheia
export function desequipar(I, est, espaco) {
  const it = est.equip[espaco];
  if (!it || est.mochila.length >= I.mochila_max) return false;
  est.mochila.push(it); est.equip[espaco] = null; return true;
}

export function descartar(est, i) { if (!est.mochila[i]) return false; est.mochila.splice(i, 1); return true; }

export function vender(I, est, i) {
  const it = est.mochila[i];
  if (!it) return 0;
  const v = precoVenda(I, it);
  est.mochila.splice(i, 1); est.ouro += v; return v;
}

// ---------- ferreiro: melhoria +1..+max ----------
// alvo: { espaco } (item vestido) ou { i } (item da mochila)
export function itemDoAlvo(est, alvo) { return alvo.espaco ? est.equip[alvo.espaco] : est.mochila[alvo.i]; }

// custo e chance de levar o item ao próximo +N (null se já está no máximo)
export function proximaMelhoria(I, it) {
  const m = I.melhoria, n = it.mais;
  if (n >= m.max) return null;
  return { para: n + 1, ouro: m.custo_ouro[n], fragmentos: m.fragmentos[n], chance: m.chance[n] };
}

// tenta melhorar; cobra ouro e fragmentos mesmo se falhar; o item nunca quebra nem perde +N.
// Devolve { feito: false, motivo } se não pôde tentar, ou { feito: true, sucesso, mais }.
export function melhorar(I, est, alvo, rng = Math.random) {
  const it = itemDoAlvo(est, alvo);
  if (!it) return { feito: false, motivo: "sem item" };
  const p = proximaMelhoria(I, it);
  if (!p) return { feito: false, motivo: "já está no máximo" };
  if (est.ouro < p.ouro) return { feito: false, motivo: "ouro insuficiente" };
  if (est.fragmentos < p.fragmentos) return { feito: false, motivo: "fragmentos insuficientes" };
  est.ouro -= p.ouro; est.fragmentos -= p.fragmentos;
  const sucesso = rng() < p.chance;
  if (sucesso) it.mais++;
  return { feito: true, sucesso, mais: it.mais };
}

// fragmentos que um monstro derrubado deixa
export function sortearFragmentos(I, def, rng) {
  if (def.comportamento === "chefe") return I.drops.fragmentos_chefe;
  return rng() < I.drops.fragmento_chance ? 1 : 0;
}
