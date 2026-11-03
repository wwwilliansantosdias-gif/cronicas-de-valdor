// Simulador de ritmo: estima o tempo de jogo até cada nível usando os MESMOS dados e fórmulas do jogo.
// Uso: node tools/simular.mjs [nivel-alvo] [classe]    (padrão 10 guerreiro)
// Modelo (aproximado, de propósito simples):
// - caça na área da região 1; cada monstro morto some e volta depois do respawn;
// - caça por bando (como no mapa): caminha até um bando e luta com os membros vivos; todos atacam ao mesmo tempo;
// - dano por segundo do jogador = soma das habilidades liberadas (dano x crítico médio / recarga) x eficiência
//   (posicionar, errar); o Giro atinge até 3 membros do bando;
// - o monstro usa o seu ataque mais forte em ciclo (aviso + recarga) e acerta parte deles (o resto o jogador desvia
//   pelo aviso); veneno soma o dano contínuo; o jogador bebe poção abaixo de 35% de vida
//   e, sem poção, volta à cidade (cura e compra poções); entre bandos, abaixo de 60% de vida, descansa
//   (espera a recuperação fora de combate encher a vida) em vez de beber poção;
// - missões do quadro entregues na volta à cidade; chefe enfrentado a partir do nível 6.
import { readFileSync } from "node:fs";
import { novoEstado, ganharXp } from "../docs/src/progresso.js";
import { derivados, aoSubir, desbloquearHabilidades } from "../docs/src/personagem.js";
import { danoHabilidade, recargaHabilidade } from "../docs/src/combate.js";
import { criarPrng } from "../docs/src/prng.js";
import { lerMapaTexto } from "../docs/src/mapa.js";

const ler = (f) => JSON.parse(readFileSync(new URL("../docs/" + f, import.meta.url), "utf8"));
// acertoMonstro: fração dos ataques que pegam (o resto o jogador desvia pelo aviso); o arqueiro luta de longe e recua
export const SUPOSICOES = { eficiencia: 0.75, aproximacao: 4, entreMembros: 0.8, acertoMonstro: { guerreiro: 0.5, arqueiro: 0.35, mago: 0.35 }, idaVolta: 45, pocoesAlvo: 3, nivelChefe: 6, descansaAbaixo: 0.6 }; // respawn vem de dados/progressao.json

export function simular({ alvo = 10, semente = 1, dados = null, sup = SUPOSICOES, classe = "guerreiro", inicio = null } = {}) {
  const P = dados?.P || ler("dados/progressao.json"), I = dados?.I || ler("dados/itens.json");
  const M = Object.fromEntries((dados?.M || ler("dados/monstros.json")).monstros.map((m) => [m.id, m]));
  const C = Object.fromEntries(ler("dados/classes.json").classes.map((c) => [c.id, c]));
  const H = dados?.H || ler("dados/habilidades.json");
  const Q = ler("dados/missoes.json").missoes;
  const R = ler("dados/regioes.json");
  const rng = criarPrng(semente);
  const est = novoEstado(P, I, classe, C[classe].habilidades[0]);
  est.autoDistribuir = true; // o simulador segue a distribuição recomendada
  const habsClasse = C[est.classe].habilidades.map((id) => H.habilidades.find((h) => h.id === id));
  // equipa o melhor item comum de cada espaço que o nível permite (conservador: não conta quedas boas)
  const equiparMelhor = () => {
    for (const esp of I.espacos) {
      const ops = I.itens.filter((b) => b.espaco === esp && (b.nivel || 1) <= est.nivel && (!b.classes || b.classes.includes(est.classe)));
      if (ops.length) { const b = ops.sort((x, y) => (y.nivel || 1) - (x.nivel || 1))[0]; est.equip[esp] = { base: b.id, qual: "comum", mais: 0, bonus: {} }; }
    }
  };
  // cada região: mapa de caça (bandos e chefe), suas missões
  const areas = Object.fromEntries(R.regioes.map((r) => {
    const spec = lerMapaTexto(readFileSync(new URL("../docs/" + R.mapas[r.cacada], import.meta.url), "utf8"));
    const bandos = [];
    for (const s of spec.spawns) for (let i = 0; i < s.n; i++) bandos.push(Array.from({ length: s.grupo }, () => ({ def: M[s.tipo], volta: 0 })));
    return [r.id, { r, bandos, chefe: spec.chefe ? [{ def: M[spec.chefe], volta: 0 }] : null }];
  }));
  let t = 0, vida = 0, mortes = 0, abates = 0, visitas = 0;
  const marcos = {}, regiaoDe = (n) => R.regioes.find((r) => n >= r.niveis[0] && n <= r.niveis[1]) || R.regioes.at(-1);
  if (inicio) { est.nivel = inicio; est.pontosLivres = P.pontos_por_nivel * (inicio - 1); aoSubir(P, est, 0, C[est.classe].recomendado, habsClasse); }
  const preco = I.itens.find((i) => i.id === "pocao").preco;
  const subir = (n) => { if (!n) return; aoSubir(P, est, n, C[est.classe].recomendado, habsClasse); equiparMelhor(); vida = derivados(P, I, est).vidaMax; for (let k = est.nivel - n + 1; k <= est.nivel; k++) marcos[k] ??= t; };
  desbloquearHabilidades(est, habsClasse); equiparMelhor(); vida = derivados(P, I, est).vidaMax;
  const aceitas = new Set();
  const cidade = () => {
    t += sup.idaVolta; visitas++;
    const sv = derivados(P, I, est); vida = sv.vidaMax;
    for (const q of Q) { const e = est.missoes[q.id]; if (e && e.estado === "pronta") { e.estado = "entregue"; est.ouro += q.recompensa.ouro; subir(ganharXp(P, est, q.recompensa.xp)); } }
    while (est.pocoes < sup.pocoesAlvo && est.ouro >= preco) { est.ouro -= preco; est.pocoes++; }
  };
  while (est.nivel < alvo && t < 40 * 3600) {
    const reg = regiaoDe(est.nivel), area = areas[reg.id];
    for (const q of Q) if (q.cidade === reg.cidade && !est.missoes[q.id]) est.missoes[q.id] = { estado: "ativa", progresso: 0 };
    const sv = derivados(P, I, est);
    const critMedio = 1 + sv.critico * (sv.criticoMult - 1);
    let dpsUm = 0, dpsArea = 0;
    let escudo = 1; // Escudo de Gelo: reduz o dano na fração do tempo em que está ativo
    for (const h of habsClasse) if (est.habilidades[h.id]) {
      if (h.forma === "escudo") { escudo = 1 - h.reducao * Math.min(1, h.duracao_efeito / recargaHabilidade(h, H.por_grau, sv.recargaMult, est.habilidades[h.id])); continue; }
      const v = danoHabilidade(h, H.por_grau, sv.dano, est.habilidades[h.id]) * (h.repeticoes || 1) * (h.tiques || 1) * critMedio / recargaHabilidade(h, H.por_grau, sv.recargaMult, est.habilidades[h.id]) * sup.eficiencia;
      if (h.forma === "circulo" || h.forma === "leque" || (h.forma === "linha" && !h.alvos)) dpsArea += v; else dpsUm += v; // área e linha sem limite atingem o bando
    }
    let bando = null;
    if (area.chefe && est.nivel >= reg.niveis[0] + sup.nivelChefe - 1 && area.chefe[0].volta <= t) bando = area.chefe;
    else { const com = area.bandos.filter((b) => b.some((m) => m.volta <= t)); if (com.length) bando = com[Math.floor(rng() * com.length)]; }
    if (!bando) { t = Math.min(...area.bandos.flat().map((m) => m.volta)); continue; }
    if (vida < 0.35 * sv.vidaMax && est.pocoes === 0) { cidade(); continue; }
    if (vida < sup.descansaAbaixo * sv.vidaMax) { // descansa: espera sem levar dano e recupera até encher
      if (sv.regen > 0) { t += P.regeneracao.espera_s + (sv.vidaMax - vida) / sv.regen; vida = sv.vidaMax; }
      else if (est.pocoes > 0) { est.pocoes--; vida = Math.min(sv.vidaMax, vida + 60); } else cidade();
      continue;
    }
    const vivos = bando.filter((m) => m.volta <= t);
    t += sup.aproximacao;
    let morreu = false;
    while (vivos.length) {
      const alvoM = vivos[0], def = alvoM.def;
      const luta = def.vida / (dpsUm + dpsArea * Math.min(vivos.length, 3)); // o dano em área conta para cada membro atingido
      const recebido = vivos.reduce((s, m) => s + dpsMonstro(m.def), 0) * (sup.acertoMonstro[classe] ?? sup.acertoMonstro) * luta * (1 - (sv.reducao || 0)) * escudo;
      t += luta + sup.entreMembros;
      if (recebido >= vida) { morreu = true; break; }
      vida -= recebido; abates++; vivos.shift();
      alvoM.volta = t + (bando === area.chefe ? P.respawn_chefe_s : P.respawn_s);
      est.ouro += (def.ouro[0] + def.ouro[1]) / 2 | 0;
      for (const q of Q) { const e = est.missoes[q.id]; if (e && e.estado === "ativa" && q.alvo === def.id && ++e.progresso >= q.quantidade) e.estado = "pronta"; }
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
  const m = (k) => rs.reduce((s, r) => s + r[k], 0) / n;
  // minutos médios em que cada nível é alcançado
  const marcos = {};
  for (let nv = 2; nv <= alvo; nv++) { const v = rs.map((r) => r.marcos[nv]).filter((x) => x != null); if (v.length) marcos[nv] = +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1); }
  return { minutos: m("minutos"), mortes: m("mortes"), abates: m("abates"), marcos, exemplo: rs[0] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const alvo = Number(process.argv[2] || 10), classe = process.argv[3] || "guerreiro";
  const m = media(alvo, 20, { classe });
  process.stdout.write(`[${classe}] `);
  console.log(`nível ${alvo}: ${m.minutos.toFixed(1)} min em média (20 simulações) · ${m.abates.toFixed(0)} abates · ${m.mortes.toFixed(1)} mortes`);
  console.log("minuto médio em que chega a cada nível:", JSON.stringify(m.marcos));
}
