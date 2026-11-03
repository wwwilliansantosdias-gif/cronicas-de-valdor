// Servidor estático de docs/ e navegador para os testes de navegador (Playwright).
// Requer: PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const RAIZ = new URL("../../docs/", import.meta.url).pathname;
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".md": "text/markdown", ".txt": "text/plain" };

export async function abrir({ largura = 844, altura = 390, toque = false } = {}) {
  const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
  const srv = http.createServer((q, r) => {
    let f = join(RAIZ, decodeURIComponent(q.url.split("?")[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": TIPOS[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f));
  }).listen(0);
  const nav = await chromium.launch();
  const pag = await nav.newPage({ viewport: { width: largura, height: altura }, hasTouch: toque });
  const erros = [];
  pag.on("pageerror", (e) => erros.push(e.message));
  pag.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  let falhas = 0;
  const ok = (c, m) => { console.log((c ? "ok   " : "FALHA") + " " + m); if (!c) falhas++; };
  const base = `http://localhost:${srv.address().port}/`;
  // espera o jogo carregar; sem save, escolhe a classe (Guerreiro por padrão) na tela de personagem novo
  const pronto = async (classe = "Guerreiro") => {
    await pag.waitForFunction(() => document.body.dataset.pronto === "1" || document.getElementById("caixa").innerText.includes("Novo personagem") || !!document.querySelector('#caixa button[data-ap]'), null, { timeout: 15000 });
    if (await pag.evaluate(() => document.body.dataset.pronto !== "1" && !document.querySelector('#caixa button[data-ap]')))
      await pag.evaluate((c) => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === c).click(), classe);
    // personagem novo: depois da classe vem a tela de aparência
    if (await pag.evaluate(() => document.body.dataset.pronto !== "1")) {
      await pag.waitForFunction(() => [...document.querySelectorAll("#caixa button")].some((b) => b.textContent === "Começar"), null, { timeout: 15000 });
      await pag.evaluate(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Começar").click());
    }
    await pag.waitForFunction(() => document.body.dataset.pronto === "1", null, { timeout: 15000 });
  };
  const fim = async () => { await nav.close(); srv.close(); console.log(falhas ? `${falhas} falha(s)` : "tudo certo"); process.exit(falhas ? 1 : 0); };
  return { pag, erros, ok, base, pronto, fim };
}
