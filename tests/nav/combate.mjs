// Combate (habilidades do jogador e ataques dos monstros). PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/combate.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const espera = (ms) => pag.waitForTimeout(ms);
await pag.goto(base); await pronto();
ok((await V(() => document.getElementById("bH1").textContent)) === "Nv 3", "Estocada bloqueada no nível 1");
ok((await V(() => document.getElementById("bH2").textContent)) === "Nv 6", "Giro bloqueado no nível 1");
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
ok((await V(() => window.__valdor.usarHabilidade("estocada"))) === false, "não usa habilidade bloqueada");
// sobe ao nível 6
await V(() => { const V = window.__valdor; while (V.est.nivel < 6) V.ganhar(50); });
await espera(150);
const est = await V(() => ({ h: window.__valdor.est.habilidades, n: window.__valdor.est.nivel }));
ok(est.h.estocada === 1 && est.h.giro === 1, "nível 6 libera Estocada e Giro: " + JSON.stringify(est.h));
ok((await V(() => document.getElementById("bH1").textContent)) === "Estocada", "botão da Estocada liberado");
// estocada alcança mais longe que o golpe
const res = await V(async () => {
  const V = window.__valdor, m = V.monstros.find((x) => x.def.id === "goblin");
  V.jogador.x = m.x - 72; V.jogador.y = m.y; V.jogador.dir = "right"; V.jogador.invul = 99; m.estado = "vagar"; m.vx = m.vy = 0; m.vagarT = 99;
  const v0 = m.vida; V.atacar(); await new Promise((r) => setTimeout(r, 600));
  const depoisGolpe = m.vida; V.jogador.x = m.x - 72; V.jogador.y = m.y;
  const usou = V.usarHabilidade("estocada"); await new Promise((r) => setTimeout(r, 120));
  const cd = document.getElementById("bH1").textContent;
  await new Promise((r) => setTimeout(r, 500));
  return { golpe: v0 - depoisGolpe, estocada: depoisGolpe - m.vida, usou, cd, denovo: V.usarHabilidade("estocada") };
});
ok(res.golpe === 0 && res.estocada > 0, "a 72 px o golpe erra e a Estocada acerta " + JSON.stringify(res));
ok(/^\d+\.\d$/.test(res.cd) && res.denovo === false, "recarga aparece no botão e impede uso imediato (" + res.cd + ")");
await pag.screenshot({ path: saida + "/c1.png" });
// giro atinge atrás
const giro = await V(async () => {
  const V = window.__valdor, m = V.monstros.find((x) => x.def.id === "javali" && !x.morto);
  V.jogador.x = m.x + 30; V.jogador.y = m.y; V.jogador.dir = "right"; m.estado = "vagar"; m.vx = m.vy = 0; m.vagarT = 99;
  const v0 = m.vida; V.usarHabilidade("giro"); await new Promise((r) => setTimeout(r, 250));
  const shot = true; await new Promise((r) => setTimeout(r, 400));
  return v0 - m.vida;
});
ok(giro > 0, "Giro acerta monstro atrás do jogador");
// aviso da investida do javali aparece e o ataque acerta quem fica parado
const inv = await V(async () => {
  const V = window.__valdor; V.jogador.invul = 0; V.jogador.vida = 999;
  const m = V.monstros.find((x) => x.def.id === "javali" && !x.morto);
  V.jogador.x = m.x + 110; V.jogador.y = m.y; m.estado = "perseguir"; m.cd = {};
  await new Promise((r) => setTimeout(r, 200));
  return { estado: m.estado, atq: m.atq && m.atq.id };
});
ok(inv.estado === "preparar" && inv.atq === "investida", "javali avisa a investida " + JSON.stringify(inv));
await pag.screenshot({ path: saida + "/c2.png" });
// veneno da cobra
const ven = await V(async () => {
  const V = window.__valdor; V.jogador.invul = 0; V.jogador.vida = 999;
  const m = V.monstros.find((x) => x.def.id === "cobra" && !x.morto);
  V.jogador.x = m.x + 30; V.jogador.y = m.y; m.estado = "perseguir"; m.cd = {};
  for (let i = 0; i < 20 && !V.jogador.veneno; i++) { await new Promise((r) => setTimeout(r, 100)); V.jogador.x = m.x + 30; V.jogador.y = m.y; }
  return { veneno: !!V.jogador.veneno, barra: document.getElementById("hpb").classList.contains("veneno") };
});
ok(ven.veneno && ven.barra, "bote da cobra envenena e a barra de vida fica verde");
// monstros longe ficam parados; 16 no mapa
const at = await V(() => { const V = window.__valdor; V.jogador.x = V.mapa.inicio.x * 32 + 16; V.jogador.y = V.mapa.inicio.y * 32 + 28; return new Promise((r) => setTimeout(() => r({ total: V.monstros.length, ativos: V.monstros.filter((m) => m.ativo).length }), 200)); });
ok(at.total >= 30 && at.ativos < at.total, "muitos monstros, só os próximos ativos: " + JSON.stringify(at));
// tempo por quadro com todos ativos (pior caso): mede atualizar + desenhar
const ms = await V(async () => {
  const V = window.__valdor; for (const m of V.monstros) { m.x = V.jogador.x + (Math.random() - 0.5) * 300; m.y = V.jogador.y + (Math.random() - 0.5) * 160; }
  const t = []; let ant = performance.now();
  await new Promise((r) => { let n = 0; const f = () => { const a = performance.now(); t.push(a - ant); ant = a; if (++n < 120) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  t.sort((a, b) => a - b); return t[Math.floor(t.length / 2)];
});
ok(ms < 20, `quadro mediano com todos os monstros perto: ${ms.toFixed(1)} ms (≈${Math.round(1000 / ms)} qps no ambiente de teste)`);
await pag.screenshot({ path: saida + "/c3.png" });
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
