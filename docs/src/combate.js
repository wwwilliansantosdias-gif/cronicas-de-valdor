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

// golpe do jogador: arco à frente; devolve monstros que morreram
export function golpear(jogador, monstros, dano) {
  const [vx, vy] = VET[jogador.dir];
  const cx = jogador.x + vx * 24, cy = jogador.y - 14 + vy * 18;
  const mortos = [];
  for (const m of monstros) {
    if (m.morto) continue;
    const raio = 26 + 8 * m.def.escala;
    if (Math.hypot(m.x - cx, m.y - 12 - cy) <= raio) {
      const kx = m.x - jogador.x, ky = m.y - jogador.y, n = Math.hypot(kx, ky) || 1;
      m.recuo = [kx / n * 60, ky / n * 60];
      if (danoEm(m, dano)) mortos.push(m); else if (m.estado === "vagar") m.estado = "perseguir";
    }
  }
  return mortos;
}

const JANELA = 0.45, TOTAL = 0.9;

// retorna o dano que o monstro causou ao jogador neste passo
export function atualizarMonstro(m, jogador, dt, mapa, rnd = Math.random) {
  if (m.morto) return 0;
  m.flash = Math.max(0, m.flash - dt);
  if (m.recuo) { mover(m, m.recuo[0] * dt, m.recuo[1] * dt, mapa); m.recuo[0] *= 0.85; m.recuo[1] *= 0.85; if (Math.abs(m.recuo[0]) + Math.abs(m.recuo[1]) < 4) m.recuo = null; }
  const dx = jogador.x - m.x, dy = jogador.y - m.y, dist = Math.hypot(dx, dy);
  const def = m.def;
  let causado = 0;
  if (m.estado === "vagar") {
    m.vagarT -= dt;
    if (m.vagarT <= 0) { m.vagarT = 1 + rnd() * 2; const a = rnd() * Math.PI * 2; m.vx = rnd() < 0.4 ? 0 : Math.cos(a); m.vy = m.vx === 0 ? 0 : Math.sin(a); }
    mover(m, m.vx * def.velocidade * 0.4 * dt, m.vy * def.velocidade * 0.4 * dt, mapa);
    if (m.vx || m.vy) m.dir = direcaoDe(m.vx, m.vy, m.dir);
    if (dist < 130 && !jogador.morto) m.estado = "perseguir";
  } else if (m.estado === "perseguir") {
    if (jogador.morto || dist > 260) { m.estado = "vagar"; return 0; }
    if (dist <= def.alcance) { m.estado = "atacar"; m.t = 0; m.atacou = false; m.dir = direcaoDe(dx, dy, m.dir); return 0; }
    const f = def.velocidade * dt / (dist || 1);
    mover(m, dx * f, dy * f, mapa);
    m.dir = direcaoDe(dx, dy, m.dir);
  } else if (m.estado === "atacar") {
    m.t += dt;
    if (!m.atacou && m.t >= JANELA) {
      m.atacou = true;
      if (dist <= def.alcance + 12 && !jogador.morto) causado = def.dano;
    }
    if (m.t >= TOTAL) { m.estado = "perseguir"; m.t = 0; }
  }
  return causado;
}
