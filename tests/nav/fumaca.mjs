// Teste de navegador (Playwright): node tests/nav/fumaca.mjs  (sobe um servidor estático em docs/)
// Requer Playwright: PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/fumaca.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const RAIZ = new URL("../../docs/", import.meta.url).pathname;
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".md": "text/markdown", ".txt": "text/plain" };
const srv = http.createServer((q, r) => {
  let f = join(RAIZ, decodeURIComponent(q.url.split("?")[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": TIPOS[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f));
}).listen(0);
const porta = srv.address().port, base = `http://localhost:${porta}/`;
const saida = process.argv[2] || "/tmp";
let falhas = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FALHA") + " " + m); if (!c) falhas++; };

const nav = await chromium.launch();
const pag = await nav.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
const erros = [], req404 = [];
pag.on("pageerror", (e) => erros.push(e.message));
pag.on("console", (m) => m.type() === "error" && erros.push(m.text()));
pag.on("response", (r) => r.status() >= 400 && req404.push(r.url()));
await pag.goto(base);
await pag.waitForFunction(() => document.body.dataset.pronto === "1", null, { timeout: 15000 });
await pag.waitForTimeout(500);
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
ok(req404.length === 0, "sem imagem/arquivo faltando: " + req404.join("|"));
await pag.screenshot({ path: saida + "/n1.png" });
const v = await pag.evaluate(() => ({ mapa: window.__valdor.mapa.id, nivel: window.__valdor.est.nivel }));
ok(v.mapa === "pe-de-lenha", "começa na cidade");
// botões de toque com pelo menos 48 px
const tam = await pag.evaluate(() => ["bA", "bP", "joy", "bM"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return Math.min(r.width, r.height); }));
ok(tam.every((t) => t >= 44), "botões grandes: " + tam.join(","));
// toque no botão de menu abre painel com créditos
await pag.touchscreen.tap(824, 28); await pag.waitForTimeout(200);
await pag.screenshot({ path: saida + "/n2.png" });
ok(await pag.evaluate(() => document.getElementById("painel").classList.contains("on")), "menu abre");
await pag.evaluate(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Créditos").click());
await pag.waitForTimeout(500);
const cred = await pag.evaluate(() => document.querySelector("#caixa pre")?.textContent || "");
ok(cred.includes("# Créditos") && cred.includes("weapon/sword/longsword"), "tela de Créditos mostra o CREDITOS.md com peças do gerador");
await pag.evaluate(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Fechar").click());
// anda para a leste até a mata
await pag.evaluate(() => { const j = window.__valdor.jogador; j.x = 37 * 32; j.y = 12 * 32 + 20; });
await pag.keyboard.down("d"); await pag.waitForTimeout(900); await pag.keyboard.up("d");
await pag.waitForTimeout(300);
ok((await pag.evaluate(() => window.__valdor.mapa.id)) === "mata-do-javali", "saída leste leva à mata");
const nm = await pag.evaluate(() => window.__valdor.monstros.length);
ok(nm >= 6 && nm <= 16, "monstros na área: " + nm);
await pag.screenshot({ path: saida + "/n3.png" });
// teletransporta para junto de um monstro e ataca
const matou = await pag.evaluate(async () => {
  const V = window.__valdor, m = V.monstros.find((x) => x.def.id === "cobra");
  V.jogador.x = m.x - 20; V.jogador.y = m.y; V.jogador.dir = "right"; V.jogador.invul = 99;
  const xp0 = V.est.xp, ouro0 = V.est.ouro;
  for (let i = 0; i < 12 && !m.morto; i++) { V.atacar(); await new Promise((r) => setTimeout(r, 650)); V.jogador.x = m.x - 20; V.jogador.y = m.y; }
  return { morto: m.morto, ganhou: V.est.xp > xp0 || V.est.nivel > 1, ouro: V.est.ouro > ouro0 };
});
ok(matou.morto && matou.ganhou && matou.ouro, "ataque mata monstro e dá experiência e ouro");
await pag.screenshot({ path: saida + "/n4.png" });
// salvar: recarrega e mantém
const antes = await pag.evaluate(() => JSON.stringify({ n: window.__valdor.est.nivel, o: window.__valdor.est.ouro, m: window.__valdor.est.mapa }));
await pag.reload(); await pag.waitForFunction(() => document.body.dataset.pronto === "1");
const depois = await pag.evaluate(() => JSON.stringify({ n: window.__valdor.est.nivel, o: window.__valdor.est.ouro, m: window.__valdor.est.mapa }));
ok(antes === depois, "progresso salvo e recarregado: " + depois);
// tela em pé mostra aviso
await pag.setViewportSize({ width: 390, height: 844 }); await pag.waitForTimeout(200);
ok(await pag.evaluate(() => getComputedStyle(document.getElementById("girar")).display === "flex"), "tela em pé mostra aviso para girar");
await nav.close(); srv.close();
console.log(falhas ? `${falhas} falha(s)` : "tudo certo"); process.exit(falhas ? 1 : 0);
