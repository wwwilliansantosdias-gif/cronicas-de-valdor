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

// ao subir n níveis: ganha pontos de atributo e de habilidade, libera habilidades do nível;
// distribui os atributos sozinho se o modo automático estiver ligado
export function aoSubir(P, est, n, recomendado, habsClasse = []) {
  if (n <= 0) return;
  est.pontosLivres += n * P.pontos_por_nivel;
  est.pontosHab = pontosHabilidadeAteNivel(P, est.nivel) - gastosHab(est);
  desbloquearHabilidades(est, habsClasse);
  if (est.autoDistribuir) distribuirRecomendado(P, est, recomendado);
}

// habilidades implementadas cujo nível foi alcançado entram no grau 1 (sem custo)
export function desbloquearHabilidades(est, habsClasse) {
  const novas = [];
  for (const h of habsClasse) if (h.implementada && est.nivel >= h.nivel && !est.habilidades[h.id]) { est.habilidades[h.id] = 1; novas.push(h); }
  return novas;
}

// gasta 1 ponto de habilidade para subir o grau; false se não puder
export function melhorarHabilidade(P, est, id) {
  const g = est.habilidades[id];
  if (!g || g >= P.grau_max_habilidade || est.pontosHab < 1) return false;
  est.habilidades[id] = g + 1; est.pontosHab--; return true;
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
  return { dano: (b.dano || 0) * f, vida: (b.vida || 0) * f, defesa: (b.defesa || 0) * f, atributos: { ...(item.bonus || {}) } };
}

// conjuntos: quantas peças de cada conjunto estão vestidas e quais bônus (2, 4, 6...) estão ativos
export function conjuntosAtivos(I, equip) {
  const vestidos = new Set(Object.values(equip).filter(Boolean).map((it) => it.base));
  return (I.conjuntos || []).map((c) => {
    const n = c.pecas.filter((p) => vestidos.has(p)).length;
    const ativos = Object.keys(c.bonus).map(Number).filter((k) => n >= k).sort((a, b) => a - b);
    return { conjunto: c, n, total: c.pecas.length, ativos, completo: n >= c.pecas.length };
  }).filter((x) => x.n > 0);
}

export function derivados(P, I, est) {
  const D = P.derivados, at = { ...est.atributos };
  let danoItens = 0, vidaItens = 0, defesa = 0;
  for (const it of Object.values(est.equip)) {
    if (!it) continue;
    const v = valoresItem(I, it);
    danoItens += v.dano; vidaItens += v.vida; defesa += v.defesa;
    for (const [a, n] of Object.entries(v.atributos)) at[a] = (at[a] || 0) + n;
  }
  for (const c of conjuntosAtivos(I, est.equip)) for (const k of c.ativos) {
    const b = c.conjunto.bonus[k];
    danoItens += b.dano || 0; vidaItens += b.vida || 0; defesa += b.defesa || 0;
    for (const [a, n] of Object.entries(b.atributos || {})) at[a] = (at[a] || 0) + n;
  }
  return {
    atributos: at,
    dano: D.dano_base + D.dano_por_for * at.for + danoItens,
    vidaMax: Math.round(D.vida_base + D.vida_por_vit * at.vit + vidaItens),
    defesa: Math.round(defesa),
    reducao: P.defesa ? defesa / (defesa + P.defesa.k) : 0,
    recargaMult: Math.max(D.recarga_min, 1 - D.recarga_por_agi * at.agi),
    velocidade: D.velocidade_base + D.velocidade_por_agi * at.agi,
    critico: Math.min(D.critico_max, D.critico_por_sor * at.sor),
    criticoMult: D.critico_mult,
    // recuperação de vida por segundo, fora de combate (Vitalidade acelera)
    regen: P.regeneracao ? Math.round((D.vida_base + D.vida_por_vit * at.vit + vidaItens) * (P.regeneracao.pct_base + P.regeneracao.pct_por_vit * at.vit) * 10) / 10 : 0,
  };
}

export function equipamentoInicial(I, classe) {
  const ini = I.equipamento_inicial[classe];
  return Object.fromEntries(I.espacos.map((e) => [e, ini[e] ? novoItem(ini[e]) : null]));
}

// "Poder": um número só que resume a força do personagem (como a força de combate do Conquer), para o jogador
// perceber o progresso por nível, pontos e itens. Usa o dano por segundo do ataque básico (com crítico médio) e a vida.
// dano que o herói realmente recebe: a Defesa reduz por defesa/(defesa+k) — quanto mais defesa, menos cada ponto rende
// escudo: redução extra temporária (Escudo de Gelo do Mago), somada à da Defesa de forma multiplicativa
export function danoRecebido(P, sv, dano, escudo = 0) {
  if (!P.defesa) return Math.max(1, Math.round(dano * (1 - escudo)));
  return Math.max(P.defesa.dano_minimo, Math.round(dano * (1 - sv.reducao) * (1 - escudo)));
}

export function estatisticas(P, sv, habBasica) {
  const critMedio = 1 + sv.critico * (sv.criticoMult - 1);
  const recarga = habBasica.recarga * sv.recargaMult;
  const dps = sv.dano * habBasica.mult * critMedio / recarga;
  const vidaEfetiva = sv.vidaMax / (1 - (sv.reducao || 0)); // vida com a defesa: quanto dano aguenta de verdade
  return { ataquesPorSeg: 1 / recarga, dps, vidaEfetiva, poder: Math.round(dps * P.poder.por_dps + vidaEfetiva * P.poder.por_vida) };
}
