// Fluxo da região 1 no navegador. PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/fluxo.mjs [pasta-de-capturas]
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
const base = `http://localhost:${srv.address().port}/`, saida = process.argv[2] || "/tmp";
let falhas = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FALHA") + " " + m); if (!c) falhas++; };
const nav = await chromium.launch(), pag = await nav.newPage({ viewport: { width: 844, height: 390 } });
const erros = []; pag.on("pageerror", (e) => erros.push(e.message)); pag.on("console", (m) => m.type() === "error" && erros.push(m.text()));
await pag.goto(base); await pag.waitForFunction(() => document.body.dataset.pronto === "1");
const V = (fn, arg) => pag.evaluate(fn, arg);
const perto = (tipo) => V((t) => { const V = window.__valdor, n = V.mapa.npcs.find((x) => x.tipo === t) || V.mapa.portal; V.jogador.x = n.x * 32 + 16; V.jogador.y = n.y * 32 + 40; V.jogador.invul = 99; V.interagir(); return document.getElementById("caixa").innerText; }, tipo);
const botao = (texto) => V((t) => { const b = [...document.querySelectorAll("#caixa button")].find((x) => x.textContent.includes(t)); if (!b || b.disabled) return false; b.click(); return true; }, texto);
const fechar = () => botao("Fechar");

// portal selado no nível 1
let t = await perto("portal");
ok(t.includes("selado") && t.includes("nível 10"), "portal selado no nível 1"); await fechar();
// mercador sem ouro não vende
t = await perto("mercador");
ok(!(await botao("Comprar poção")), "mercador não vende sem ouro"); await fechar();
await V(() => { window.__valdor.est.ouro = 100; });
await perto("mercador"); ok(await botao("Comprar poção"), "compra poção com ouro");
ok((await V(() => window.__valdor.est.pocoes)) === 2 && (await V(() => window.__valdor.est.ouro)) === 80, "ouro e poções atualizados"); await fechar();
// ferreiro
const dano0 = await V(() => window.__valdor.est.equip.arma.mais);
await perto("ferreiro"); ok(await botao("Afiar"), "afia a espada"); await fechar();
ok((await V(() => window.__valdor.est.equip.arma.mais)) === dano0 + 1, "arma subiu de nível (+N)");
// quadro
await perto("quadro"); ok(await botao("Aceitar: Trilha limpa"), "aceita missão"); await fechar();
ok((await V(() => window.__valdor.est.missoes.javalis.estado)) === "ativa", "missão ativa");
// mata 6 javalis na mata (dano forçado para o teste de fluxo)
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
const mortos = await V(async () => {
  const V = window.__valdor; let n = 0;
  for (let i = 0; i < 4; i++) {
    const m = V.monstros.find((x) => x.def.id === "javali" && !x.morto) || (() => { return null; })();
    if (!m) break;
    V.jogador.x = m.x - 20; V.jogador.y = m.y; V.jogador.dir = "right"; V.jogador.invul = 99; V.jogador.recarga = 0;
    for (let k = 0; k < 20 && !m.morto; k++) { V.atacar(); await new Promise((r) => setTimeout(r, 560)); V.jogador.x = m.x - 20; V.jogador.y = m.y; }
    if (m.morto) n++;
  }
  return n;
});
ok(mortos === 4, "há 4 javalis na mata; matamos 4 (" + mortos + ")");
ok((await V(() => window.__valdor.est.missoes.javalis.progresso)) === 4, "progresso da missão contado (4/6)");
await V(() => { window.__valdor.est.missoes.javalis.progresso = 6; window.__valdor.est.missoes.javalis.estado = "pronta"; window.__valdor.entrar("pe-de-lenha", null); });
const ouroAntes = await V(() => window.__valdor.est.ouro);
await perto("quadro"); ok(await botao("Entregar: Trilha limpa"), "entrega missão"); await fechar();
ok((await V(() => window.__valdor.est.ouro)) === ouroAntes + 30, "recompensa de ouro recebida");
// portal libera no nível 10
await V(() => { window.__valdor.est.nivel = 9; }); t = await perto("portal"); ok(t.includes("selado"), "nível 9: selado"); await fechar();
await V(() => { window.__valdor.est.nivel = 10; }); t = await perto("portal"); ok(t.includes("aberto"), "nível 10: aberto"); await fechar();
await pag.screenshot({ path: saida + "/f1.png" });
// chefe: existe, é maior e tem coroa; morte devolve à cidade com nível mantido
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
const chefe = await V(() => { const m = window.__valdor.monstros.find((x) => x.def.comportamento === "chefe"); return m && { vida: m.vida, escala: m.def.escala }; });
ok(chefe && chefe.vida === 480 && chefe.escala > 1, "chefe presente e maior");
await V(() => { const V = window.__valdor, m = V.monstros.find((x) => x.def.comportamento === "chefe"); V.jogador.x = m.x - 60; V.jogador.y = m.y; V.jogador.invul = 0; V.est.ouro = 100; });
await pag.screenshot({ path: saida + "/f2.png" });
await V(() => { const V = window.__valdor; V.jogador.vida = 1; const m = V.monstros.find((x) => x.def.comportamento === "chefe"); V.jogador.x = m.x - 18; V.jogador.y = m.y; });
await pag.waitForFunction(() => window.__valdor.mapa.id === "pe-de-lenha", null, { timeout: 12000 });
const p = await V(() => ({ nv: window.__valdor.est.nivel, ouro: window.__valdor.est.ouro, vida: window.__valdor.jogador.vida }));
ok(p.nv === 10 && p.ouro < 100 && p.ouro > 0 && p.vida > 1, "morte: volta à cidade, mantém nível, perde parte do ouro " + JSON.stringify(p));
// poção
await V(() => { const V = window.__valdor; V.jogador.vida = 10; V.est.pocoes = 1; });
await pag.keyboard.press("q"); await pag.waitForTimeout(100);
ok((await V(() => window.__valdor.jogador.vida)) === 70 && (await V(() => window.__valdor.est.pocoes)) === 0, "poção cura 60");
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await nav.close(); srv.close(); console.log(falhas ? `${falhas} falha(s)` : "tudo certo"); process.exit(falhas ? 1 : 0);
