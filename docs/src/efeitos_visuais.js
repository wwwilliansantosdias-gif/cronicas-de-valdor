// Efeitos visuais dos equipamentos (etapa 11), desenhados por cima das camadas: contorno, pulsar, clarão no ataque,
// partículas paradas no item, rastro da flecha, estouro no impacto e aura no chão. A força de cada um vem de
// equipamento.efeitos(raridade, reforço). Pensado para celular: contorno preparado uma vez por imagem e cor (memória),
// partículas com limite total, e nada é desenhado quando a força é 0 (chave de efeitos desligada).

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const contornos = new Map();
// contorno de uma folha inteira: 1 px forte e 1 px fraco em volta dos pixels do item, já na cor pedida
export function contornoDe(img, cor = "#ffffff") {
  const k = img; let porCor = contornos.get(k);
  if (!porCor) { porCor = new Map(); contornos.set(k, porCor); }
  if (porCor.has(cor)) return porCor.get(cor);
  const w = img.width, h = img.height, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const src = x.getImageData(0, 0, w, h).data, out = x.createImageData(w, h), d = out.data, [r, g, b] = rgb(cor);
  const cheio = (i, j) => i >= 0 && j >= 0 && i < w && j < h && src[(j * w + i) * 4 + 3] > 40;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (cheio(i, j)) continue;
    let a = 0;
    if (cheio(i - 1, j) || cheio(i + 1, j) || cheio(i, j - 1) || cheio(i, j + 1)) a = 255;
    else if (cheio(i - 2, j) || cheio(i + 2, j) || cheio(i, j - 2) || cheio(i, j + 2) || cheio(i - 1, j - 1) || cheio(i + 1, j + 1) || cheio(i - 1, j + 1) || cheio(i + 1, j - 1)) a = 110;
    if (a) { const p = (j * w + i) * 4; d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = a; }
  }
  x.clearRect(0, 0, w, h); x.putImageData(out, 0, 0);
  porCor.set(cor, c);
  return c;
}

// cor do brilho tirada do próprio item: o tom claro da paleta usada (ou dourado, se o item não troca de cor)
export function corDoItem(trocas, padrao = "#ffd36a") {
  if (!trocas || !trocas.length) return padrao;
  const [r, g, b] = trocas[Math.min(4, trocas.length - 1)][1];
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// intensidade do pulsar (entre 1-forca e 1)
export function pulso(t, forca) { return forca ? 1 - forca * 0.5 * (1 + Math.sin(t * 5)) : 1; }

// aura no chão: elipse com degradê, pulsando devagar
export function desenharAura(ctx, x, y, forca, cor, t) {
  if (!forca) return;
  const [r, g, b] = rgb(cor), rx = 20 + 6 * forca, ry = rx * 0.38;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
  const a = (0.25 + 0.35 * forca) * (0.75 + 0.25 * Math.sin(t * 3));
  gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(0.7, `rgba(${r},${g},${b},${a * 0.45})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
}

// clarão no ataque: estouro de luz que some em ~0,2 s (p de 0 a 1)
export function desenharClarao(ctx, x, y, forca, p, cor = "#ffffff") {
  if (!forca || p < 0 || p > 1) return;
  const [r, g, b] = rgb(cor), raio = 6 + 18 * forca * p, a = forca * (1 - p);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const gr = ctx.createRadialGradient(x, y, 0, x, y, raio);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.4, `rgba(${r},${g},${b},${a * 0.7})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, raio, 0, 7); ctx.fill(); ctx.restore();
}

// partículas com limite total (todas as fontes juntas não passam de "max")
export class Particulas {
  constructor(max = 24) { this.max = max; this.lista = []; }
  emitir(x, y, cor, n = 1, opcoes = {}) {
    for (let k = 0; k < n && this.lista.length < this.max; k++) {
      const a = Math.random() * Math.PI * 2, v = (opcoes.velocidade ?? 8) * (0.4 + Math.random());
      this.lista.push({ x: x + (Math.random() - 0.5) * (opcoes.espalha ?? 10), y: y + (Math.random() - 0.5) * (opcoes.espalha ?? 10),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opcoes.sobe ?? 10), vida: opcoes.vida ?? 0.8, t: 0, cor, tam: opcoes.tam ?? 1 });
    }
  }
  atualizar(dt) {
    for (const p of this.lista) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.lista = this.lista.filter((p) => p.t < p.vida);
  }
  desenhar(ctx) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of this.lista) { ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam); }
    ctx.restore();
  }
  get quantidade() { return this.lista.length; }
  limpar() { this.lista = []; }
}

// flecha voando com rastro opcional (força 0 = sem rastro)
export function desenharFlecha(ctx, x, y, dir, rastro, cor) {
  if (rastro) {
    const [r, g, b] = rgb(cor), comp = 10 + 16 * rastro;
    const gr = ctx.createLinearGradient(x - dir * comp, y, x, y);
    gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(1, `rgba(${r},${g},${b},${0.4 + 0.5 * rastro})`);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.fillRect(Math.min(x, x - dir * comp), y - 1, comp, 3); ctx.restore();
  }
  ctx.fillStyle = "#e9e2cf"; ctx.fillRect(Math.round(x - dir * 9), Math.round(y), 9, 1);
  ctx.fillStyle = "#9aa3ad"; ctx.fillRect(Math.round(x), Math.round(y) - 1, 2, 3);
}

// estouro no impacto: anel que abre e some (p de 0 a 1)
export function desenharImpacto(ctx, x, y, forca, p, cor) {
  if (!forca || p < 0 || p > 1) return;
  const [r, g, b] = rgb(cor);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(${r},${g},${b},${forca * (1 - p)})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 3 + 12 * forca * p, 0, 7); ctx.stroke(); ctx.restore();
}
