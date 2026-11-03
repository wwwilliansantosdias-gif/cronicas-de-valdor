// Grava um vídeo do jogo sendo jogado por um robô com teclado de verdade (andar, mirar, atacar, habilidades, poção).
// Uso: PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tools/gravar_partida.mjs <pasta-de-saída>
// Parte 1: personagem novo (nível 1) na cidade e na Mata. Parte 2: personagem evoluído preparado no save
// (nível 9, equipamento melhor, arma +5) para mostrar habilidades, defesa e efeitos.
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
import http from "node:http";
import { readFileSync, existsSync, statSync, readdirSync, renameSync } from "node:fs";
import { extname, join } from "node:path";
const RAIZ = new URL("../docs/", import.meta.url).pathname, saida = process.argv[2] || "/tmp";
const T = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".md": "text/markdown", ".txt": "text/plain" };
const srv = http.createServer((q, r) => { let f = join(RAIZ, decodeURIComponent(q.url.split("?")[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html"); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }).listen(0);
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, recordVideo: { dir: saida, size: { width: 844, height: 390 } } });
const pag = await ctx.newPage();
const V = (fn, a) => pag.evaluate(fn, a), espera = (ms) => pag.waitForTimeout(ms);
const teclas = new Set();
const segura = async (quero) => { for (const k of [...teclas]) if (!quero.includes(k)) { await pag.keyboard.up(k); teclas.delete(k); } for (const k of quero) if (!teclas.has(k)) { await pag.keyboard.down(k); teclas.add(k); } };
// anda até o ponto (em peças) em linha reta
async function irPara(tx, ty, limite = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < limite) {
    const j = await V(() => ({ x: window.__valdor.jogador.x, y: window.__valdor.jogador.y }));
    const dx = tx * 32 + 16 - j.x, dy = ty * 32 + 28 - j.y;
    if (Math.hypot(dx, dy) < 12) break;
    const k = []; if (dx > 6) k.push("d"); if (dx < -6) k.push("a"); if (dy > 6) k.push("s"); if (dy < -6) k.push("w");
    await segura(k); await espera(80);
  }
  await segura([]);
}
// caça: vai até o monstro vivo mais perto, encara e ataca; usa habilidades e poção
async function cacar(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await V(() => { const V = window.__valdor, j = V.jogador; let m = null, d = 1e9;
      for (const x of V.monstros) if (!x.morto) { const dd = Math.hypot(x.x - j.x, x.y - j.y); if (dd < d) { d = dd; m = x; } }
      return { jx: j.x, jy: j.y, mx: m && m.x, my: m && m.y, d, vida: j.vida, max: V.est ? 1 : 1, pocoes: V.est.pocoes, classe: V.est.classe }; });
    if (s.mx == null) { await segura([]); await espera(200); continue; }
    if (s.vida < 45 && s.pocoes > 0) await pag.keyboard.press("q");
    const dx = s.mx - s.jx, dy = s.my - s.jy, alcance = s.classe === "arqueiro" ? 150 : 26;
    if (s.d > alcance) { const k = []; if (dx > 8) k.push("d"); if (dx < -8) k.push("a"); if (dy > 8) k.push("s"); if (dy < -8) k.push("w"); await segura(k); await espera(90); continue; }
    // encara o monstro: um toque curto na direção dominante
    await segura([]); const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : (dy > 0 ? "s" : "w");
    await pag.keyboard.down(dir); await espera(30); await pag.keyboard.up(dir);
    await pag.keyboard.press("2"); await pag.keyboard.press("1"); await pag.keyboard.press(" "); await espera(220);
  }
  await segura([]);
}
await pag.goto(`http://localhost:${srv.address().port}/`);
await pag.waitForFunction(() => document.getElementById("caixa").innerText.includes("Novo personagem"));
await espera(1500);
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Guerreiro").click());
await pag.waitForFunction(() => document.body.dataset.pronto === "1"); await espera(1200);
// cidade: quadro de missões
await irPara(16, 12); await espera(300);
await V(() => window.__valdor.interagir()); await espera(1500);
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent.startsWith("Aceitar"))?.click()); await espera(1200);
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Fechar")?.click()); await espera(400);
// ferreiro e saída para a Mata
await irPara(25, 13); await espera(600); await irPara(38, 12);
await segura(["d"]); await pag.waitForFunction(() => window.__valdor.mapa.id === "mata-do-javali", null, { timeout: 8000 }); await segura([]);
await espera(800);
await cacar(38000);
// parte 2: personagem evoluído (preparado no save)
await V(() => { const V = window.__valdor, E = V.est; while (E.nivel < 9) V.ganhar(60); E.pontosLivres = 0; E.atributos = { for: 22, vit: 13, agi: 5, sor: 5 };
  const it = (b, q = "comum", m = 0, bonus = {}) => ({ base: b, qual: q, mais: m, bonus });
  Object.assign(E.equip, { arma: it("sabre", "lendario", 5, { for: 2, sor: 2 }), escudo: it("escudo-redondo", "raro", 2, { vit: 2 }), capacete: it("capuz"), ombros: it("ombreiras-manto"), peitoral: it("cota-malha", "raro", 3, { vit: 2 }), bracos: it("luvas"), capa: it("capa-lisa", "refinado"), grevas: it("calca-reforcada"), botas: it("botas-dobradas") });
  E.habilidades.estocada = 3; E.habilidades.giro = 2; E.pontosHab = 0; E.pocoes = 5; V.jogador.vida = 999; });
await espera(500);
await V(() => document.getElementById("bI").dispatchEvent(new PointerEvent("pointerdown"))); await espera(3500);
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Fechar")?.click()); await espera(500);
await cacar(40000);
await ctx.close(); await nav.close(); srv.close();
const vid = readdirSync(saida).filter((f) => f.endsWith(".webm")).map((f) => join(saida, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
renameSync(vid, join(saida, "partida.webm"));
console.log("vídeo:", join(saida, "partida.webm"));
