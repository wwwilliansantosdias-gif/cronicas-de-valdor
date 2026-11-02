// Simulador de ritmo: estima o tempo de jogo até cada nível usando os MESMOS dados e fórmulas do jogo.
// Uso: node tools/simular.mjs [nivel-alvo]    (padrão 10)
// Modelo (aproximado, de propósito simples):
// - caça na área da região 1; cada monstro morto some e volta depois do respawn;
// - caça por bando (como no mapa): caminha até um bando e luta com os membros vivos; todos atacam ao mesmo tempo;
// - dano por segundo do jogador = soma das habilidades liberadas (dano x crítico médio / recarga) x eficiência
//   (posicionar, errar); o Giro atinge até 3 membros do bando;
// - o monstro usa o seu ataque mais forte em ciclo (aviso + recarga) e acerta parte deles (o resto o jogador desvia
//   pelo aviso); veneno soma o dano contínuo; o jogador bebe poção abaixo de 35% de vida
//   e, sem poção, volta à cidade (cura e compra poções);
// - missões do quadro entregues na volta à cidade; chefe enfrentado a partir do nível 6.
import { readFileSync } from "node:fs";
import { novoEstado, ganharXp } from "../docs/src/progresso.js";
import { derivados, aoSubir, desbloquearHabilidades } from "../docs/src/personagem.js";
import { danoHabilidade, recargaHabilidade } from "../docs/src/combate.js";
import { criarPrng } from "../docs/src/prng.js";
import { lerMapaTexto } from "../docs/src/mapa.js";

const ler = (f) => JSON.parse(readFileSync(new URL("../docs/" + f, import.meta.url), "utf8"));
export const SUPOSICOES = { eficiencia: 0.75, aproximacao: 4, entreMembros: 0.8, acertoMonstro: 0.5, idaVolta: 45, pocoesAlvo: 3, nivelChefe: 6 }; // respawn vem de dados/progressao.json

export function simular({ alvo = 10, semente = 1, dados = null, sup = SUPOSICOES } = {}) {
  const P = dados?.P || ler("dados/progressao.json"), I = dados?.I || ler("dados/itens.json");
  const M = Object.fromEntries((dados?.M || ler("dados/monstros.json")).monstros.map((m) => [m.id, m]));
  const C = Object.fromEntries(ler("dados/classes.json").classes.map((c) => [c.id, c]));
  const H = ler("dados/habilidades.json");
  const Q = ler("dados/missoes.json").missoes;
  const spec = lerMapaTexto(readFileSync(new URL("../docs/mapas/mata-do-javali.txt", import.meta.url), "utf8"));
  const rng = criarPrng(semente);
  const est = novoEstado(P, I);
  est.autoDistribuir = true; // o simulador segue a distribuição recomendada
  for (const q of Q) est.missoes[q.id] = { estado: "ativa", progresso: 0 };
  const bandos = [];
  for (const s of spec.spawns) for (let i = 0; i < s.n; i++) bandos.push(Array.from({ length: s.grupo }, () => ({ def: M[s.tipo], volta: 0 })));
  const chefe = [{ def: M[spec.chefe], volta: 0 }];
  let t = 0, vida = derivados(P, I, est).vidaMax, mortes = 0, abates = 0, visitas = 0;
  const marcos = {};
  const preco = I.itens.find((i) => i.id === "pocao").preco;
  const cidade = () => {
    t += sup.idaVolta; visitas++;
    const sv = derivados(P, I, est); vida = sv.vidaMax;
    for (const q of Q) { const e = est.missoes[q.id]; if (e.estado === "pronta") { e.estado = "entregue"; est.ouro += q.recompensa.ouro; subir(ganharXp(P, est, q.recompensa.xp)); } }
    while (est.pocoes < sup.pocoesAlvo && est.ouro >= preco) { est.ouro -= preco; est.pocoes++; }
  };
  const habsClasse = C[est.classe].habilidades.map((id) => H.habilidades.find((h) => h.id === id));
  desbloquearHabilidades(est, habsClasse);
  const subir = (n) => { if (!n) return; aoSubir(P, est, n, C[est.classe].recomendado, habsClasse); vida = derivados(P, I, est).vidaMax; for (let k = est.nivel - n + 1; k <= est.nivel; k++) marcos[k] ??= t; };
  while (est.nivel < alvo && t < 6 * 3600) {
    const sv = derivados(P, I, est);
    const critMedio = 1 + sv.critico * (sv.criticoMult - 1);
    let dpsUm = 0, dpsArea = 0;
    for (const h of habsClasse) if (est.habilidades[h.id]) {
      const v = danoHabilidade(h, H.por_grau, sv.dano, est.habilidades[h.id]) * critMedio / recargaHabilidade(h, H.por_grau, sv.recargaMult, est.habilidades[h.id]) * sup.eficiencia;
      if (h.forma === "circulo") dpsArea += v; else dpsUm += v;
    }
    let bando = null;
    if (est.nivel >= sup.nivelChefe && chefe[0].volta <= t) bando = chefe;
    else { const com = bandos.filter((b) => b.some((m) => m.volta <= t)); if (com.length) bando = com[Math.floor(rng() * com.length)]; }
    if (!bando) { t = Math.min(...bandos.flat().map((m) => m.volta)); continue; }
    if (vida < 0.35 * sv.vidaMax) { if (est.pocoes > 0) { est.pocoes--; vida = Math.min(sv.vidaMax, vida + 60); } else cidade(); continue; }
    const vivos = bando.filter((m) => m.volta <= t);
    t += sup.aproximacao;
    let morreu = false;
    while (vivos.length) {
      const alvoM = vivos[0], def = alvoM.def;
      const luta = def.vida / (dpsUm + dpsArea * Math.min(vivos.length, 3)); // o dano em área conta para cada membro atingido
      const recebido = vivos.reduce((s, m) => s + dpsMonstro(m.def), 0) * sup.acertoMonstro * luta;
      t += luta + sup.entreMembros;
      if (recebido >= vida) { morreu = true; break; }
      vida -= recebido; abates++; vivos.shift();
      alvoM.volta = t + (bando === chefe ? P.respawn_chefe_s : P.respawn_s);
      est.ouro += (def.ouro[0] + def.ouro[1]) / 2 | 0;
      for (const q of Q) { const e = est.missoes[q.id]; if (e.estado === "ativa" && q.alvo === def.id && ++e.progresso >= q.quantidade) e.estado = "pronta"; }
      subir(ganharXp(P, est, def.xp));
      if (vida < 0.25 * derivados(P, I, est).vidaMax && est.pocoes > 0) { est.pocoes--; vida += 60; }
    }
    if (morreu) { mortes++; est.ouro = Math.floor(est.ouro * 0.8); cidade(); }
  }
  return { minutos: t / 60, marcos: Object.fromEntries(Object.entries(marcos).map(([k, v]) => [k, +(v / 60).toFixed(1)])), mortes, abates, visitas, nivel: est.nivel };
}

// dano por segundo do ataque mais forte do monstro, em ciclo de aviso + recarga (veneno incluso)
export function dpsMonstro(def) {
  return Math.max(...def.ataques.map((a) => (def.dano * a.mult + (a.veneno ? a.veneno.dps * a.veneno.duracao : 0)) / (a.aviso + Math.max(a.recarga, a.pos || 0))));
}

export function media(alvo = 10, n = 20, opts = {}) {
  const rs = Array.from({ length: n }, (_, i) => simular({ alvo, semente: i + 1, ...opts }));
  return { minutos: rs.reduce((s, r) => s + r.minutos, 0) / n, mortes: rs.reduce((s, r) => s + r.mortes, 0) / n, abates: rs.reduce((s, r) => s + r.abates, 0) / n, exemplo: rs[0] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const alvo = Number(process.argv[2] || 10);
  const m = media(alvo);
  console.log(`nível ${alvo}: ${m.minutos.toFixed(1)} min em média (20 simulações) · ${m.abates.toFixed(0)} abates · ${m.mortes.toFixed(1)} mortes`);
  console.log("minuto em que chega a cada nível (simulação 1):", JSON.stringify(m.exemplo.marcos));
}
