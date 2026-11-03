import { criarPrng } from "./prng.js";

export const TILE = 32;
// pegadas em peças: árvore 2x2, lagoa 3x3, prédio 6x5
const TAM = { arvore: [2, 2], lagoa: [3, 3], predio: [6, 5] };

export function lerMapaTexto(txt) {
  const m = { saidas: [], predios: [], npcs: [], spawns: [], zonaSegura: false, arvores: 0, lagoas: 0, chefe: null, portal: null, clareira: null };
  for (const bruta of txt.split("\n")) {
    const linha = bruta.split("#")[0].trim();
    if (!linha) continue;
    const i = linha.indexOf(":");
    if (i < 0) throw new Error("linha de mapa sem ':': " + linha);
    const k = linha.slice(0, i).trim();
    const v = linha.slice(i + 1).trim();
    const num = (s) => s.split(",").map(Number);
    if (k === "mapa") m.id = v;
    else if (k === "tamanho") { const [w, h] = v.split("x").map(Number); m.w = w; m.h = h; }
    else if (k === "semente") m.semente = Number(v);
    else if (k === "base") m.base = v;
    else if (k === "zona_segura") m.zonaSegura = v === "sim";
    else if (k === "arvores") m.arvores = Number(v);
    else if (k === "lagoas") m.lagoas = Number(v);
    else if (k === "clareira") { const [x, y, r] = num(v); m.clareira = { x, y, r }; }
    else if (k === "predio") { // "predio: tipo x,y LxA" (construção montada em assets/cidade) ou o antigo "predio: x,y"
      const p = v.split(/\s+/);
      if (p.length === 1) { const [x, y] = num(p[0]); m.predios.push({ nome: "casa_antiga", x, y, w: 6, h: 5 }); }
      else { const [x, y] = num(p[1]); const [w, h] = p[2].split("x").map(Number); m.predios.push({ nome: p[0], x, y, w, h }); }
    }
    else if (k === "npc") { const [t, xy] = v.split(/\s+/); const [x, y] = num(xy); m.npcs.push({ tipo: t, x, y }); }
    else if (k === "portal") { const [xy, para] = v.split(/\s+/); const [x, y] = num(xy); m.portal = { x, y, para }; }
    else if (k === "saida") { const [lado, destino] = v.split(/\s+/); m.saidas.push({ lado, destino }); }
    else if (k === "spawn") { // "spawn: tipo N" (N soltos) ou "spawn: tipo N grupo G" (N bandos de G)
      const [t, n, g, tam] = v.split(/\s+/);
      if (g !== undefined && g !== "grupo") throw new Error("spawn: esperava 'grupo' em: " + v);
      m.spawns.push({ tipo: t, n: Number(n), grupo: tam ? Number(tam) : 1 });
    }
    else if (k === "chefe") m.chefe = v;
    else throw new Error("chave de mapa desconhecida: " + k);
  }
  if (!m.id || !m.w || !m.h) throw new Error("mapa precisa de 'mapa' e 'tamanho'");
  return m;
}

export function bloqueadoTile(mapa, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= mapa.w || ty >= mapa.h) return true;
  return mapa.bloq[ty * mapa.w + tx] === 1;
}

function marcar(bloq, w, h, x, y, tw, th, v = 1) {
  for (let j = y; j < y + th; j++) for (let i = x; i < x + tw; i++) if (i >= 0 && j >= 0 && i < w && j < h) bloq[j * w + i] = v;
}

function livre(bloq, w, h, x, y, tw, th, reservado) {
  if (x < 1 || y < 1 || x + tw > w - 1 || y + th > h - 1) return false;
  for (let j = y; j < y + th; j++) for (let i = x; i < x + tw; i++) if (bloq[j * w + i] || reservado[j * w + i]) return false;
  return true;
}

export function alcancaveis(mapa, tx, ty) {
  const { w, h } = mapa;
  const vis = new Uint8Array(w * h);
  if (bloqueadoTile(mapa, tx, ty)) return vis;
  const fila = [[tx, ty]];
  vis[ty * w + tx] = 1;
  while (fila.length) {
    const [x, y] = fila.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!bloqueadoTile(mapa, nx, ny) && !vis[ny * w + nx]) { vis[ny * w + nx] = 1; fila.push([nx, ny]); }
    }
  }
  return vis;
}

// lado -> peça de chegada (dentro do mapa, ao lado da abertura)
function pontoDeLado(spec, lado) {
  const mx = Math.floor(spec.w / 2), my = Math.floor(spec.h / 2);
  return { oeste: { x: 1, y: my }, leste: { x: spec.w - 2, y: my }, norte: { x: mx, y: 1 }, sul: { x: mx, y: spec.h - 2 } }[lado];
}

export function gerarMapa(spec) {
  const { w, h } = spec;
  const rng = criarPrng(spec.semente ?? 1);
  const bloq = new Uint8Array(w * h);
  const reservado = new Uint8Array(w * h);
  // bordas bloqueadas, com abertura de 4 peças em cada saída
  for (let i = 0; i < w; i++) { bloq[i] = 1; bloq[(h - 1) * w + i] = 1; }
  for (let j = 0; j < h; j++) { bloq[j * w] = 1; bloq[j * w + w - 1] = 1; }
  const mx = Math.floor(w / 2), my = Math.floor(h / 2);
  const saidas = spec.saidas.map((s) => {
    const p = pontoDeLado(spec, s.lado);
    if (s.lado === "oeste" || s.lado === "leste") marcar(bloq, w, h, s.lado === "oeste" ? 0 : w - 1, my - 2, 1, 4, 0);
    else marcar(bloq, w, h, mx - 2, s.lado === "norte" ? 0 : h - 1, 4, 1, 0);
    return { ...s, entrada: p };
  });
  // corredor reservado: das saídas até o centro/clareira
  const alvoX = spec.clareira ? spec.clareira.x : mx;
  const alvoY = spec.clareira ? spec.clareira.y : my;
  for (const s of saidas) {
    const x0 = Math.min(s.entrada.x, alvoX), x1 = Math.max(s.entrada.x, alvoX);
    marcar(reservado, w, h, x0, my - 1, x1 - x0 + 1, 3);
    marcar(reservado, w, h, alvoX - 1, Math.min(my, alvoY) - 1, 3, Math.abs(alvoY - my) + 3);
  }
  const objetos = [];
  const pos = (tipo, x, y, tw = TAM[tipo][0], th = TAM[tipo][1], nome) => { marcar(bloq, w, h, x, y, tw, th); objetos.push({ tipo, x, y, w: tw, h: th, ...(nome ? { nome } : {}) }); };
  // reservas fixas
  if (spec.clareira) {
    const { x, y, r } = spec.clareira;
    for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if ((i - x) ** 2 + (j - y) ** 2 <= r * r) marcar(reservado, w, h, i, j, 1, 1);
  }
  for (const n of spec.npcs) marcar(reservado, w, h, n.x - 2, n.y - 2, 5, 5);
  if (spec.portal) marcar(reservado, w, h, spec.portal.x - 2, spec.portal.y - 2, 5, 5);
  // prédios (posição dada)
  for (const p of spec.predios) pos("predio", p.x, p.y, p.w, p.h, p.nome);
  // lagoas e árvores
  for (let n = 0, t = 0; n < spec.lagoas && t < 500; t++) {
    const x = 2 + Math.floor(rng() * (w - 7)), y = 2 + Math.floor(rng() * (h - 7));
    if (livre(bloq, w, h, x, y, 3, 3, reservado)) { pos("lagoa", x, y); n++; }
  }
  const alvo = Math.floor(spec.arvores * w * h / 4);
  for (let n = 0, t = 0; n < alvo && t < alvo * 20; t++) {
    const x = 1 + Math.floor(rng() * (w - 3)), y = 1 + Math.floor(rng() * (h - 3));
    if (livre(bloq, w, h, x, y, 2, 2, reservado)) { pos("arvore", x, y); objetos[objetos.length - 1].v = rng() < 0.5 ? 0 : 1; n++; }
  }
  const mapa = { id: spec.id, w, h, base: spec.base, semente: spec.semente, bloq, objetos, saidas, zonaSegura: spec.zonaSegura,
    npcs: spec.npcs.map((n) => ({ ...n })), portal: spec.portal ? { ...spec.portal } : null, spawns: [], chefe: null, clareira: spec.clareira };
  // entrada padrão: primeira saída, ou centro
  const inicio = saidas[0] ? saidas[0].entrada : { x: mx, y: my };
  mapa.inicio = inicio;
  const vis = alcancaveis(mapa, inicio.x, inicio.y);
  const ok = (x, y) => vis[y * w + x] === 1;
  // chefe no centro da clareira
  if (spec.chefe) {
    if (!spec.clareira || !ok(spec.clareira.x, spec.clareira.y)) throw new Error("chefe sem clareira alcançável");
    mapa.chefe = { tipo: spec.chefe, x: spec.clareira.x, y: spec.clareira.y };
  }
  // monstros em bandos: centros livres, alcançáveis, longe da entrada, do chefe e de outros bandos;
  // membros do bando em peças livres a até 2 peças do centro
  const centros = [];
  for (const s of spec.spawns) {
    for (let n = 0, t = 0; n < s.n; t++) {
      if (t > 6000) throw new Error("sem espaço para spawn de " + s.tipo);
      const x = 2 + Math.floor(rng() * (w - 4)), y = 2 + Math.floor(rng() * (h - 4));
      if (!ok(x, y) || Math.hypot(x - inicio.x, y - inicio.y) < 10) continue;
      if (centros.some((p) => Math.hypot(p.x - x, p.y - y) < 6)) continue;
      if (mapa.chefe && Math.hypot(mapa.chefe.x - x, mapa.chefe.y - y) < 6) continue;
      const membros = [{ x, y }];
      for (let k = 0; k < 60 && membros.length < s.grupo; k++) {
        const mx2 = x + Math.floor(rng() * 5) - 2, my2 = y + Math.floor(rng() * 5) - 2;
        if (mx2 > 0 && my2 > 0 && mx2 < w - 1 && my2 < h - 1 && ok(mx2, my2) && !membros.some((p) => p.x === mx2 && p.y === my2)) membros.push({ x: mx2, y: my2 });
      }
      if (membros.length < s.grupo) continue;
      centros.push({ x, y });
      for (const p of membros) mapa.spawns.push({ tipo: s.tipo, x: p.x, y: p.y, bando: centros.length - 1 });
      n++;
    }
  }
  // verificações: tudo que o jogador precisa alcançar
  const pontos = [...saidas.map((s) => s.entrada), ...spec.npcs.map((n) => ({ x: n.x, y: n.y })), ...(spec.portal ? [{ x: spec.portal.x, y: spec.portal.y }] : [])];
  for (const p of pontos) if (!ok(p.x, p.y)) throw new Error(`ponto inalcançável (${p.x},${p.y}) em ${spec.id}`);
  return mapa;
}

export function pecaLivreEmPixels(mapa, x, y) {
  return !bloqueadoTile(mapa, Math.floor(x / TILE), Math.floor(y / TILE));
}
