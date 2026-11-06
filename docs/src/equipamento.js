// Sistema de equipamentos da etapa 11 (documentacao/etapa-11-equipamentos-lpc.md). Regras puras, sem desenho:
// quais imagens (camadas) compõem cada item e o personagem, em que ordem (zPos das definições do gerador LPC),
// com que troca de cor (paleta), se o item cabe no encaixe e na classe, que efeitos a raridade e o reforço ligam,
// e os créditos. Dados: dados/lpc_definicoes.json (gerado), catalogo_equipamentos.json, raridades.json.

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function dados({ defs, catalogo, raridades }) {
  return { defs, catalogo, raridades, itens: Object.fromEntries(catalogo.itens.map((it) => [it.id, it])) };
}

// ---------- raridade ----------
export function ordemRaridades(R) { return [...R.ordem]; }
export function raridade(R, id) {
  const r = R.raridades[id];
  if (!r) throw new Error(`raridade desconhecida: ${id}`);
  return { id, ...r };
}

// ---------- cores ----------
// "material.nome" -> 6 tons (paleta oficial do gerador ou valdor.*)
export function paleta(D, cor) {
  const [m, nome] = cor.split("."), p = D.defs.paletas[m];
  if (!p || !p.cores[nome]) throw new Error(`cor desconhecida: ${cor}`);
  return p.cores[nome];
}
function item(D, id) { const it = D.itens[id]; if (!it) throw new Error(`item desconhecido: ${id}`); return it; }
function definicao(D, f) { const d = D.defs.definicoes[f]; if (!d) throw new Error(`definição ausente: ${f}`); return d; }

// cor pedida para uma parte do item: "raridade" vira a cor da tabela pelo material da parte
function resolverCor(D, parte, cor, rar, material) {
  if (cor !== "raridade") return cor;
  const c = raridade(D.raridades, rar).cores[material];
  if (!c) throw new Error(`a raridade ${rar} não define cor para ${material} (${parte.def})`);
  return c;
}
export function corDaParte(D, itemId, i, rar) {
  const parte = item(D, itemId).formato[i], d = definicao(D, parte.def);
  return resolverCor(D, parte, parte.cor, rar, parte.material || d.recolors[0]?.material);
}
const pares = (de, para) => de.map((c, i) => [rgb(c), rgb(para[i])]);

// ---------- camadas ----------
function arquivoDa(cam, anim, variante) {
  if (cam.custom) return variante ? cam.pasta + variante + ".png" : cam.pasta.replace(/\/$/, "") + ".png";
  return cam.pasta + anim + (variante ? "/" + variante : "") + ".png";
}
// camadas de UMA parte (definição) numa animação; "aparencia" dá as cores de pele/cabelo/olhos ("body.light"...)
function camadasDaParte(D, parte, anim, rar, aparencia = {}) {
  if (parte.so_animacoes && !parte.so_animacoes.includes(anim)) return [];
  const d = definicao(D, parte.def);
  let usada = anim, grupo = d.por_animacao[anim];
  if (typeof grupo === "string") { usada = grupo; grupo = d.por_animacao[usada]; } // ex.: Estocada usa o golpe
  if (!grupo) return [];
  let variante = null, trocas = [];
  const doJogador = (c) => (c === "pele" || c === "cabelo" ? aparencia[c] || null : c);
  if (d.recolors.length) { // uma imagem base + troca de paleta por cor (como o gerador)
    d.recolors.forEach((rec, k) => {
      const pedida = k === 0 ? doJogador(parte.cor) : k === 1 && parte.cor2 ? parte.cor2 : rec.material === "eye" ? aparencia.olhos || null : null;
      if (!pedida || !D.defs.paletas[rec.material]) return;
      const base = rec.base || D.defs.paletas[rec.material].base, cor = resolverCor(D, parte, pedida, rar, rec.material);
      if (cor !== `${rec.material}.${base}`) trocas.push(...pares(D.defs.paletas[rec.material].cores[base], paleta(D, cor)));
    });
  } else if (parte.cor.startsWith("variante.")) variante = parte.cor.slice(9);
  else { // só variantes prontas: usa a pronta se existir; senão troca a paleta da imagem base (se ela estiver numa paleta)
    const cor = resolverCor(D, parte, parte.cor, rar, parte.material), nome = cor.split(".")[1];
    if (d.variantes.includes(nome)) variante = nome;
    else { variante = d.base_variante; if (d.paleta_base) trocas = pares(paleta(D, d.paleta_base), paleta(D, cor)); }
  }
  return grupo.map((i) => { const cam = d.camadas[i];
    return { z: cam.z, arquivo: arquivoDa(cam, usada, variante), tamanho: cam.tamanho, anim: usada, trocas, parte: parte.def }; });
}
export function camadasDoItem(D, itemId, anim, rar, aparencia) {
  return item(D, itemId).formato.flatMap((p) => camadasDaParte(D, p, anim, rar, aparencia).map((c) => ({ ...c, item: itemId })));
}
// ordem de desenho: do menor zPos para o maior; empate mantém a ordem de chegada
export function ordenarPorZ(lista) {
  return lista.map((c, i) => [c, i]).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]).map(([c]) => c);
}
// personagem inteiro: base da classe (corpo, cabeça, cabelo, aljava...) + cada encaixe { item, raridade, reforco }
export function camadasDoPersonagem(D, classe, equip, anim, aparencia) {
  const out = D.catalogo.base_personagem[classe].flatMap((p) => camadasDaParte(D, p, anim, "comum", aparencia).map((c) => ({ ...c, item: null })));
  for (const [enc, e] of Object.entries(equip)) {
    if (!e) continue;
    const ok = podeEquipar(D, e.item, enc, classe);
    if (!ok.ok) throw new Error(ok.motivo);
    out.push(...camadasDoItem(D, e.item, anim, e.raridade, aparencia).map((c) => ({ ...c, encaixe: enc, raridade: e.raridade, reforco: e.reforco || 0 })));
  }
  return ordenarPorZ(out);
}

// ---------- encaixes ----------
export function podeEquipar(D, itemId, encaixe, classe) {
  const it = D.itens[itemId], enc = D.catalogo.encaixes[encaixe];
  if (!it) return { ok: false, motivo: `item desconhecido: ${itemId}` };
  if (!enc) return { ok: false, motivo: `encaixe desconhecido: ${encaixe}` };
  if (it.encaixe !== encaixe) return { ok: false, motivo: `${it.nome} vai no encaixe ${D.catalogo.encaixes[it.encaixe].nome}, não em ${enc.nome}` };
  if (!enc.classes.includes(classe) || !it.classes.includes(classe)) return { ok: false, motivo: `${it.nome} não é da classe ${classe}` };
  return { ok: true };
}

// ---------- efeitos ----------
const EFEITOS = ["contorno", "pulsar", "clarao", "impacto", "particulas", "rastro", "aura"];
// força de cada efeito (0 a 1) e quantidade de partículas, pela raridade e pelo reforço (+0 a +max); "ligados" = chave geral
export function efeitos(R, rar, reforco = 0, ligados = true) {
  const rf = R.reforco;
  if (!Number.isInteger(reforco) || reforco < 0 || reforco > rf.max) throw new Error(`reforço fora de 0..${rf.max}: ${reforco}`);
  const base = raridade(R, rar).efeitos, extra = reforco * rf.por_nivel, out = {};
  for (const k of EFEITOS) out[k] = ligados && base[k] ? Math.min(1, base[k] + extra) : 0;
  if (ligados) {
    if (reforco >= rf.contorno_a_partir) out.contorno = Math.max(out.contorno, Math.min(1, 0.2 + extra));
    if (reforco >= rf.particulas_a_partir) out.particulas = Math.max(out.particulas, Math.min(1, 0.2 + extra));
    if (reforco >= rf.aura_a_partir) out.aura = Math.max(out.aura, Math.min(1, 0.2 + extra));
  }
  out.qtdParticulas = Math.min(R.limites.particulas_max, Math.round(out.particulas * R.limites.particulas_por_forca));
  return out;
}

// ---------- créditos ----------
// um registro por arquivo de crédito de cada definição usada (itens do catálogo e base do personagem)
export function creditosDoCatalogo(D, ids = Object.keys(D.itens)) {
  const formatos = new Set([...ids.flatMap((id) => item(D, id).formato.map((p) => p.def)),
    ...Object.values(D.catalogo.base_personagem).flatMap((ps) => ps.map((p) => p.def))]);
  const out = [];
  for (const f of [...formatos].sort()) {
    const d = definicao(D, f);
    if (!d.creditos || !d.creditos.length) throw new Error(`sem créditos: ${f}`);
    for (const c of d.creditos) out.push({ formato: f, arquivo: c.file, autores: c.authors, licencas: c.licenses, urls: c.urls, notas: c.notes || "" });
  }
  return out;
}

// ---------- memória das imagens recoloridas ----------
export function chaveRecolor(arquivo, trocas) { return arquivo + "|" + trocas.map(([, p]) => p.join(",")).join(";"); }
// guarda o resultado de "gerar(arquivo, trocas)" (no jogo: um canvas recolorido) para não refazer a cada quadro
export class CacheRecolor {
  constructor(gerar) { this.gerar = gerar; this.mapa = new Map(); }
  obter(arquivo, trocas) {
    if (!trocas.length) return null;
    const k = chaveRecolor(arquivo, trocas);
    if (!this.mapa.has(k)) this.mapa.set(k, this.gerar(arquivo, trocas));
    return this.mapa.get(k);
  }
  get tamanho() { return this.mapa.size; }
}
