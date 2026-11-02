// Personagem: atributos, pontos, fórmulas derivadas e bônus de equipamento.
// Recebe as tabelas de dados (progressao.json, itens.json, classes.json) por parâmetro: nada fixo no código.

export function pontosAteNivel(P, nivel) { return P.pontos_por_nivel * (nivel - 1); }
export function pontosHabilidadeAteNivel(P, nivel) { return Math.floor(nivel / P.nivel_por_ponto_habilidade); }

export function atributosIniciais(P) { return Object.fromEntries(P.atributos.map((a) => [a, P.atributo_inicial])); }

export function gastos(P, est) { return P.atributos.reduce((s, a) => s + est.atributos[a] - P.atributo_inicial, 0); }

// coloca n pontos livres no atributo a; devolve false se não puder
export function distribuir(P, est, a, n = 1) {
  if (!P.atributos.includes(a) || !Number.isInteger(n) || n < 1 || est.pontosLivres < n) return false;
  est.atributos[a] += n; est.pontosLivres -= n; return true;
}

// distribui todos os pontos livres seguindo a proporção recomendada da classe (ex.: for 2, vit 1)
export function distribuirRecomendado(P, est, recomendado) {
  const ordem = [];
  for (const a of P.atributos) for (let i = 0; i < (recomendado[a] || 0); i++) ordem.push(a);
  if (!ordem.length) return 0;
  let i = 0, feitos = 0;
  while (est.pontosLivres > 0) { distribuir(P, est, ordem[i % ordem.length]); i++; feitos++; }
  return feitos;
}

export function custoRedistribuir(P, est) { return P.redistribuir_custo_por_nivel * est.nivel; }

// devolve todos os pontos gastos; cobra ouro; false se não houver ouro ou nada a devolver.
// Desliga a distribuição automática: quem redistribui quer escolher onde pôr os pontos.
export function redistribuir(P, est) {
  const custo = custoRedistribuir(P, est), g = gastos(P, est);
  if (g === 0 || est.ouro < custo) return false;
  est.ouro -= custo; est.atributos = atributosIniciais(P); est.pontosLivres += g; est.autoDistribuir = false; return true;
}

// ao subir n níveis: ganha pontos de atributo e de habilidade; distribui sozinho se o modo automático estiver ligado
export function aoSubir(P, est, n, recomendado) {
  if (n <= 0) return;
  est.pontosLivres += n * P.pontos_por_nivel;
  est.pontosHab = pontosHabilidadeAteNivel(P, est.nivel) - gastosHab(est);
  if (est.autoDistribuir) distribuirRecomendado(P, est, recomendado);
}

export function gastosHab(est) { return Object.values(est.habilidades).reduce((s, g) => s + g - 1, 0); }

// ---------- itens ----------
export function qualidade(I, id) { return I.qualidades.find((q) => q.id === id); }
export function baseItem(I, id) { return I.itens.find((x) => x.id === id); }

export function novoItem(base, qual = "comum", mais = 0, bonus = {}) { return { base, qual, mais, bonus }; }

// valores do item já com qualidade e melhoria: { dano, vida, atributos:{...} }
export function valoresItem(I, item) {
  const b = baseItem(I, item.base), q = qualidade(I, item.qual);
  const f = q.mult * (1 + I.melhoria.bonus_por_nivel * item.mais);
  return { dano: (b.dano || 0) * f, vida: (b.vida || 0) * f, atributos: { ...(item.bonus || {}) } };
}

export function derivados(P, I, est) {
  const D = P.derivados, at = { ...est.atributos };
  let danoItens = 0, vidaItens = 0;
  for (const it of Object.values(est.equip)) {
    if (!it) continue;
    const v = valoresItem(I, it);
    danoItens += v.dano; vidaItens += v.vida;
    for (const [a, n] of Object.entries(v.atributos)) at[a] = (at[a] || 0) + n;
  }
  return {
    atributos: at,
    dano: D.dano_base + D.dano_por_for * at.for + danoItens,
    vidaMax: Math.round(D.vida_base + D.vida_por_vit * at.vit + vidaItens),
    recargaMult: Math.max(D.recarga_min, 1 - D.recarga_por_agi * at.agi),
    velocidade: D.velocidade_base + D.velocidade_por_agi * at.agi,
    critico: Math.min(D.critico_max, D.critico_por_sor * at.sor),
    criticoMult: D.critico_mult,
  };
}

export function equipamentoInicial(I, classe) {
  return Object.fromEntries(Object.entries(I.equipamento_inicial[classe]).map(([e, id]) => [e, novoItem(id)]));
}
