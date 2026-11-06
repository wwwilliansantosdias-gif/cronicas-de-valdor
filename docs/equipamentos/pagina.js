// Página de aprovação: arqueiro parado e atirando com os 3 arcos em cada uma das 5 raridades, seletor de reforço
// (+0 a +12) e chave de efeitos. Usa o sistema da etapa 11 (src/equipamento.js e src/efeitos_visuais.js).
import { dados, ordemRaridades, raridade, camadasDoPersonagem, efeitos, creditosDoCatalogo, CacheRecolor } from "../src/equipamento.js";
import { recolorir } from "../src/aparencia.js";
import { contornoDe, corDoItem, pulso, desenharAura, desenharClarao, Particulas, desenharFlecha, desenharImpacto } from "../src/efeitos_visuais.js";

const $ = (id) => document.getElementById(id);
const json = (f) => fetch("../dados/" + f).then((r) => r.json());
const imagem = (src) => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error(src)); i.src = src; });

const [defs, catalogo, raridades] = await Promise.all(["lpc_definicoes.json", "itens.json", "raridades.json"].map(json));
const D = dados({ defs, catalogo, raridades }), R = D.raridades;
const ARCOS = ["arco-simples", "arco-recurvo", "arco-longo"], RAR = ordemRaridades(R);
const APARENCIA = { pele: "body.light", cabelo: "hair.dark_brown", olhos: "eye.blue" }; // aparência padrão do jogo (dados/aparencia.json)
const ROUPA = { peitoral: "gibao-couro", grevas: "calca", botas: "botas-couro", bracos: "bracadeiras-couro" };
const estado = { reforco: 0, ligados: true, linha: 3 };

// camadas de cada célula (não mudam com o reforço: o reforço só mexe nos efeitos)
const equipDe = (arco, rar) => ({ arma: { item: arco, raridade: rar, reforco: 0 }, ...Object.fromEntries(Object.entries(ROUPA).map(([e, i]) => [e, { item: i, raridade: "comum", reforco: 0 }])) });
const celulas = [];
for (const rar of RAR) for (const arco of ARCOS)
  celulas.push({ rar, arco, walk: camadasDoPersonagem(D, "arqueiro", equipDe(arco, rar), "walk", APARENCIA), shoot: camadasDoPersonagem(D, "arqueiro", equipDe(arco, rar), "shoot", APARENCIA) });

// imagens: carrega só as usadas; recolore uma vez por imagem+cor (memória)
const IMG = {};
const arquivos = new Set(celulas.flatMap((c) => [...c.walk, ...c.shoot].map((l) => l.arquivo)));
await Promise.all([...arquivos].map(async (a) => { IMG[a] = await imagem("../assets/lpc/" + a); }));
const cache = new CacheRecolor((arquivo, trocas) => {
  const img = IMG[arquivo], c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height);
  recolorir(d.data, trocas); x.putImageData(d, 0, 0); return c;
});
const folha = (l) => cache.obter(l.arquivo, l.trocas) || IMG[l.arquivo];

// centro do arco no quadro atual (pixels do item), guardado por imagem+quadro
const centros = new Map();
function centroDo(img, sx, sy, s) {
  const k = img; let m = centros.get(k); if (!m) { m = new Map(); centros.set(k, m); }
  const kk = sx + "," + sy; if (m.has(kk)) return m.get(kk);
  const c = document.createElement("canvas"); c.width = s; c.height = s; const x = c.getContext("2d"); x.drawImage(img, sx, sy, s, s, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data; let sxm = 0, sym = 0, n = 0;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (d[(j * s + i) * 4 + 3] > 40) { sxm += i; sym += j; n++; }
  const r = n ? { x: sxm / n - (s - 64) / 2, y: sym / n - (s - 64) / 2 } : { x: 32, y: 32 }; m.set(kk, r); return r;
}

// grade
const grade = $("grade");
for (const a of ARCOS) grade.insertAdjacentHTML("beforeend", `<div class="cab">${D.itens[a].nome}</div>`);
for (const rar of RAR) {
  const r = raridade(R, rar);
  grade.insertAdjacentHTML("beforeend", `<div class="rar" style="color:${r.cor_nome}">${r.nome}</div>`);
  for (const arco of ARCOS) {
    const cel = celulas.find((c) => c.rar === rar && c.arco === arco);
    const div = document.createElement("div"); div.className = "cel"; div.style.borderColor = r.moldura;
    div.innerHTML = `<div class="nome" style="color:${r.cor_nome}"></div><div class="par"><canvas class="parado" width="64" height="64"></canvas><canvas class="atirando" width="120" height="64"></canvas></div><div class="legenda"><span>parado</span><span>atirando</span></div>`;
    grade.appendChild(div);
    Object.assign(cel, { div, parado: div.querySelector(".parado"), atirando: div.querySelector(".atirando"), part: new Particulas(R.limites.particulas_max), partTiro: new Particulas(R.limites.particulas_max), flechas: [], clarao: -1, impactos: [] });
  }
}
function nomes() { for (const c of celulas) c.div.querySelector(".nome").textContent = `${D.itens[c.arco].nome} ${raridade(R, c.rar).nome}${estado.reforco ? " +" + estado.reforco : ""}`; }
nomes();

// créditos das definições mostradas
const cr = creditosDoCatalogo(D, [...ARCOS, ...Object.values(ROUPA)]);
$("creditos").innerHTML = cr.map((c) => `<li><b>${c.formato}</b>: ${c.autores.join(", ")} · ${c.licencas.join(", ")} · ${c.urls.map((u) => `<a href="${u}">página</a>`).join(" ")}</li>`).join("");

// controles
$("reforco").addEventListener("input", (e) => { estado.reforco = +e.target.value; $("nreforco").textContent = "+" + estado.reforco; nomes(); });
$("efeitos").addEventListener("change", (e) => { estado.ligados = e.target.checked; if (!estado.ligados) for (const c of celulas) { c.part.limpar(); c.partTiro.limpar(); } });
$("direcao").addEventListener("change", (e) => { estado.linha = +e.target.value; });

// desenho de um boneco: aura, camadas por zPos, contorno do arco por cima de cada camada do arco
function boneco(ctx, camadas, quadro, linha, ox, oy, cel, ef, t, cor) {
  desenharAura(ctx, ox + 32, oy + 60, ef.aura, cor, t);
  for (const l of camadas) {
    const s = l.tamanho, img = folha(l), sx = quadro * s, sy = linha * s, dx = ox - (s - 64) / 2, dy = oy - (s - 64) / 2;
    if (!img || sx >= img.width) continue;
    ctx.drawImage(img, sx, sy, s, s, dx, dy, s, s);
    if (l.item === cel.arco && ef.contorno) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, ef.contorno * pulso(t, ef.pulsar));
      ctx.drawImage(contornoDe(img, cor), sx, sy, s, s, dx, dy, s, s); ctx.restore();
    }
  }
}

const SOLTA = 9, QUADROS = 13, FPS = 12, CICLO = QUADROS / FPS + 0.7;
let antes = performance.now();
function passo(agora) {
  const dt = Math.min(0.05, (agora - antes) / 1000), t = agora / 1000; antes = agora;
  for (const cel of celulas) {
    const ef = efeitos(R, cel.rar, estado.reforco, estado.ligados), arma = cel.shoot.find((l) => l.item === cel.arco), cor = raridade(R, cel.rar).brilho || corDoItem(arma.trocas, "#ffd36a");
    // parado
    const p = cel.parado.getContext("2d"); p.imageSmoothingEnabled = false; p.clearRect(0, 0, 64, 64);
    boneco(p, cel.walk, 0, estado.linha, 0, 0, cel, ef, t, cor);
    // partículas paradas no arco (no boneco parado)
    const lw = cel.walk.find((l) => l.item === cel.arco), cen = centroDo(folha(lw), 0, estado.linha * lw.tamanho, lw.tamanho);
    if (ef.qtdParticulas && cel.part.quantidade < ef.qtdParticulas && Math.random() < 0.5) cel.part.emitir(cen.x, cen.y, cor, 1, { espalha: 14, velocidade: 4, sobe: 8, vida: 0.9, tam: 2 });
    cel.part.atualizar(dt); cel.part.desenhar(p);
    // atirando: ciclo de 13 quadros + pausa; a flecha sai no quadro SOLTA
    const a = cel.atirando.getContext("2d"); a.imageSmoothingEnabled = false; a.clearRect(0, 0, 120, 64);
    a.fillStyle = "#6b4a2b"; a.fillRect(110, 30, 3, 30); a.fillStyle = "#d8c08a"; a.beginPath(); a.ellipse(111, 30, 4, 9, 0, 0, 7); a.fill(); // alvo
    const fase = (t + celulas.indexOf(cel) * 0.07) % CICLO, q = Math.min(QUADROS - 1, Math.floor(fase * FPS));
    const linhaTiro = 3; // atirando sempre para a direita, na direção do alvo
    if (cel.ultimoQ !== undefined && cel.ultimoQ < SOLTA && q >= SOLTA) { cel.flechas.push({ x: 50, y: 31 }); cel.clarao = 0; }
    cel.ultimoQ = q;
    boneco(a, cel.shoot, q, linhaTiro, 0, 0, cel, ef, t, cor);
    if (cel.clarao >= 0) { desenharClarao(a, 46, 30, ef.clarao, cel.clarao / 0.2, cor); cel.clarao += dt; if (cel.clarao > 0.2) cel.clarao = -1; }
    for (const f of cel.flechas) { f.x += 260 * dt; desenharFlecha(a, f.x, f.y, 1, ef.rastro, cor); }
    for (const f of cel.flechas.filter((f) => f.x >= 108)) { cel.impactos.push({ x: 109, y: f.y, p: 0 }); if (ef.impacto) cel.partTiro.emitir(109, f.y, cor, Math.min(6, 2 + ef.qtdParticulas / 4), { espalha: 4, velocidade: 30, sobe: 0, vida: 0.35, tam: 2 }); }
    cel.flechas = cel.flechas.filter((f) => f.x < 108);
    for (const im of cel.impactos) { desenharImpacto(a, im.x, im.y, ef.impacto, im.p, cor); im.p += dt / 0.3; }
    cel.impactos = cel.impactos.filter((im) => im.p <= 1);
    cel.partTiro.atualizar(dt); cel.partTiro.desenhar(a);
  }
  requestAnimationFrame(passo);
}
requestAnimationFrame(passo);

// ganchos para o teste de navegador
window.__equip = {
  celulas: celulas.length, estado,
  particulas: () => celulas.reduce((s, c) => s + c.part.quantidade + c.partTiro.quantidade, 0),
  recoloridas: () => cache.tamanho,
  efeitos: (rar) => efeitos(R, rar, estado.reforco, estado.ligados),
};
document.body.dataset.pronto = "1";
