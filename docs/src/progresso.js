// Experiência e níveis. A curva vem de dados/progressao.json (xp_base, xp_expoente, nivel_max).
import { atributosIniciais, equipamentoInicial } from "./personagem.js";

// xp para ir do nível n ao n+1: curva base × multiplicador da faixa (as regiões novas pedem mais tempo por nível)
export function xpParaProximo(P, n) {
  const f = (P.xp_faixas || []).find((x) => n <= x.ate);
  return Math.round(P.xp_base * n ** P.xp_expoente * (f ? f.mult : 1));
}

// habInicial: a habilidade de nível 1 da classe (classes.json "habilidades"[0])
export function novoEstado(P, I, classe = "guerreiro", habInicial = "golpe", aparencia = null) {
  return { versao: 4, classe, aparencia, nivel: 1, xp: 0, ouro: 0, pocoes: 1, mapa: "pe-de-lenha", missoes: {},
    atributos: atributosIniciais(P), pontosLivres: 0, autoDistribuir: false,
    habilidades: { [habInicial]: 1 }, pontosHab: 0, equip: equipamentoInicial(I, classe), mochila: [], fragmentos: 0 };
}

// devolve quantos níveis subiu (pontos são concedidos por personagem.aoSubir)
export function ganharXp(P, est, xp) {
  let subiu = 0;
  est.xp += xp;
  while (est.nivel < P.nivel_max && est.xp >= xpParaProximo(P, est.nivel)) {
    est.xp -= xpParaProximo(P, est.nivel);
    est.nivel++;
    subiu++;
  }
  if (est.nivel >= P.nivel_max) est.xp = 0;
  return subiu;
}

export function portalLiberado(est, regiao) {
  return !!regiao.portal_proxima && est.nivel >= regiao.portal_proxima.nivel_minimo;
}

// morrer: mantém o nível, perde parte do ouro
export function aoMorrer(est) { est.ouro = Math.floor(est.ouro * 0.8); }
