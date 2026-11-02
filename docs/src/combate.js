import { bloqueadoTile, TILE } from "./mapa.js";

export const VET = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function direcaoDe(dx, dy, atual = "down") {
  if (dx === 0 && dy === 0) return atual;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
}

// caixa dos pés: 14 px de largura, 8 de altura
export function colide(mapa, x, y) {
  for (const [ox, oy] of [[-7, 0], [7, 0], [-7, -8], [7, -8]]) {
    if (bloqueadoTile(mapa, Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return true;
  }
  return false;
}

export function mover(ent, dx, dy, mapa) {
  if (!colide(mapa, ent.x + dx, ent.y)) ent.x += dx;
  if (!colide(mapa, ent.x, ent.y + dy)) ent.y += dy;
}

export function criarMonstro(def, x, y) {
  return { def, x, y, spawnX: x, spawnY: y, vida: def.vida, vidaMax: def.vida, dir: "down", estado: "vagar", t: 0, ataquePronto: true, atacou: false,
    vagarT: 0, vx: 0, vy: 0, morto: false, mortoEm: 0, flash: 0 };
}

// aplica dano; devolve true só na chamada que mata (uma vez)
export function danoEm(ent, d) {
  if (ent.morto) return false;
  ent.vida = Math.max(0, ent.vida - d);
  ent.flash = 0.15;
  if (ent.vida === 0) { ent.morto = true; return true; }
  return false;
}

// distância do ponto (px,py) ao segmento (ax,ay)-(bx,by)
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// o monstro m está dentro da área da habilidade h usada pelo jogador j?
export function dentroDaArea(j, m, h) {
  const [vx, vy] = VET[j.dir];
  const mx = m.x, my = m.y - 12, folga = 8 * m.def.escala, ox = j.x, oy = j.y - 14;
  if (h.forma === "arco") return Math.hypot(mx - (ox + vx * h.alcance), my - (oy + vy * h.alcance * 0.75)) <= h.raio + folga;
  if (h.forma === "linha") return distSegmento(mx, my, ox, oy, ox + vx * h.alcance, oy + vy * h.alcance) <= h.raio + folga;
  if (h.forma === "circulo") return Math.hypot(mx - ox, my - oy) <= h.raio + folga;
  throw new Error("forma de habilidade desconhecida: " + h.forma);
}

// dano final de uma habilidade no grau g
export function danoHabilidade(h, porGrau, danoBase, grau = 1) { return danoBase * h.mult * (1 + porGrau.mult * (grau - 1)); }
export function recargaHabilidade(h, porGrau, recargaMult, grau = 1) { return h.recarga * recargaMult * (1 + porGrau.recarga * (grau - 1)); }

// aplica a habilidade; devolve { mortos, atingidos, criticos }
export function atingir(j, monstros, h, dano, critico = 0, critMult = 1.5, rnd = Math.random) {
  const r = { mortos: [], atingidos: 0, criticos: 0 };
  for (const m of monstros) {
    if (m.morto || !dentroDaArea(j, m, h)) continue;
    const crit = rnd() < critico;
    const kx = m.x - j.x, ky = m.y - j.y, n = Math.hypot(kx, ky) || 1, emp = h.empurrao || 60;
    m.recuo = [kx / n * emp, ky / n * emp];
    r.atingidos++; if (crit) r.criticos++;
    if (danoEm(m, crit ? dano * critMult : dano)) r.mortos.push(m); else if (m.estado === "vagar") m.estado = "perseguir";
  }
  return r;
}

// Monstros: cada um tem uma lista de ataques (dados/monstros.json). Ciclo: perseguir -> preparar (aviso visível)
// -> executar -> recuperar. Tipos: "corpo" (acerta quem está no raio ao fim do aviso), "investida" (corre em
// linha reta e acerta no contato; o bote da cobra é uma investida curta) e "area" (acerta tudo no raio em volta).
// Devolve { dano, veneno } causados ao jogador neste passo.
export function atualizarMonstro(m, jogador, dt, mapa, rnd = Math.random) {
  const res = { dano: 0, veneno: null };
  if (m.morto) return res;
  m.flash = Math.max(0, m.flash - dt);
  m.cd = m.cd || {};
  for (const k in m.cd) m.cd[k] = Math.max(0, m.cd[k] - dt);
  if (m.recuo && m.estado !== "executar") { mover(m, m.recuo[0] * dt, m.recuo[1] * dt, mapa); m.recuo[0] *= 0.85; m.recuo[1] *= 0.85; if (Math.abs(m.recuo[0]) + Math.abs(m.recuo[1]) < 4) m.recuo = null; }
  const dx = jogador.x - m.x, dy = jogador.y - m.y, dist = Math.hypot(dx, dy);
  const def = m.def;
  const acerta = (a) => { res.dano += def.dano * a.mult; if (a.veneno) res.veneno = a.veneno; };
  if (m.estado === "vagar") {
    m.vagarT -= dt;
    if (m.vagarT <= 0) { m.vagarT = 1 + rnd() * 2; const ang = rnd() * Math.PI * 2; m.vx = rnd() < 0.4 ? 0 : Math.cos(ang); m.vy = m.vx === 0 ? 0 : Math.sin(ang); }
    mover(m, m.vx * def.velocidade * 0.4 * dt, m.vy * def.velocidade * 0.4 * dt, mapa);
    if (m.vx || m.vy) m.dir = direcaoDe(m.vx, m.vy, m.dir);
    if (dist < 130 && !jogador.morto) m.estado = "perseguir";
  } else if (m.estado === "perseguir") {
    if (jogador.morto || dist > 260) { m.estado = "vagar"; return res; }
    m.dir = direcaoDe(dx, dy, m.dir);
    const a = def.ataques.find((x) => !m.cd[x.id] && dist >= (x.alcance_min || 0) && dist <= x.alcance);
    if (a) {
      m.estado = "preparar"; m.atq = a; m.t = 0; m.atingiu = false;
      m.alvo = [dx / (dist || 1), dy / (dist || 1)]; // direção travada no início do aviso: dá para desviar
      return res;
    }
    const perto = Math.min(...def.ataques.map((x) => x.alcance));
    if (dist > perto * 0.8) { const f = def.velocidade * dt / (dist || 1); mover(m, dx * f, dy * f, mapa); }
  } else if (m.estado === "preparar") {
    m.t += dt;
    if (m.t >= m.atq.aviso) {
      const a = m.atq;
      m.estado = "executar"; m.t = 0;
      if (a.tipo === "corpo" && dist <= a.raio && !jogador.morto) { acerta(a); m.atingiu = true; }
      if (a.tipo === "area" && dist <= a.raio && !jogador.morto) { acerta(a); m.atingiu = true; }
      if (a.tipo !== "investida") { m.estado = "recuperar"; m.cd[a.id] = a.recarga; }
    }
  } else if (m.estado === "executar") { // só investidas ficam aqui
    const a = m.atq;
    m.t += dt;
    const x0 = m.x, y0 = m.y;
    mover(m, m.alvo[0] * a.velocidade * dt, m.alvo[1] * a.velocidade * dt, mapa);
    const parou = Math.hypot(m.x - x0, m.y - y0) < a.velocidade * dt * 0.3; // bateu em parede
    if (!m.atingiu && !jogador.morto && Math.hypot(jogador.x - m.x, jogador.y - m.y) <= a.raio) { acerta(a); m.atingiu = true; }
    if (m.t >= a.duracao || parou) { m.estado = "recuperar"; m.t = 0; m.cd[a.id] = a.recarga; }
  } else if (m.estado === "recuperar") {
    m.t += dt;
    if (m.t >= (m.atq?.pos ?? 0.3)) { m.estado = "perseguir"; m.t = 0; }
  }
  return res;
}
