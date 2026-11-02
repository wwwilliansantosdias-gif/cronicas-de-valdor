export const NIVEL_MAX = 29;

export function xpParaProximo(n) { return Math.round(6 * n ** 1.6); }

export function novoEstado() {
  return { versao: 1, classe: "guerreiro", nivel: 1, xp: 0, ouro: 0, pocoes: 1, armaNivel: 0, mapa: "pe-de-lenha", missoes: {} };
}

// devolve quantos níveis subiu
export function ganharXp(est, xp) {
  let subiu = 0;
  est.xp += xp;
  while (est.nivel < NIVEL_MAX && est.xp >= xpParaProximo(est.nivel)) {
    est.xp -= xpParaProximo(est.nivel);
    est.nivel++;
    subiu++;
  }
  if (est.nivel >= NIVEL_MAX) est.xp = 0;
  return subiu;
}

export function statsJogador(nivel, armaNivel = 0, melhoria = 3) {
  return { vidaMax: 90 + 12 * (nivel - 1), dano: 8 + 2.5 * (nivel - 1) + melhoria * armaNivel };
}

export function portalLiberado(est, regiao) {
  return !!regiao.portal_proxima && est.nivel >= regiao.portal_proxima.nivel_minimo;
}

// morrer: mantém o nível, perde parte do ouro
export function aoMorrer(est) { est.ouro = Math.floor(est.ouro * 0.8); }

export function custoMelhoria(est, cfg) { return cfg.custo_base * (est.armaNivel + 1); }
