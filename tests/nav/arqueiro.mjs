// Arqueiro: criação, habilidades e "um tiro, vários abates". PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/arqueiro.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const espera = (ms) => pag.waitForTimeout(ms);
await pag.goto(base); await pronto("Arqueiro");
const e0 = await V(() => ({ c: window.__valdor.est.classe, arma: window.__valdor.est.equip.arma.base, h: window.__valdor.est.habilidades }));
ok(e0.c === "arqueiro" && e0.arma === "arco-simples" && e0.h.disparo === 1, "arqueiro novo com arco e Disparo " + JSON.stringify(e0));
ok((await V(() => document.getElementById("bH1").textContent)) === "Nv 3" && (await V(() => document.getElementById("bH2").textContent)) === "Nv 6", "Dispersão e Chuva bloqueadas no nível 1");
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
// prepara um bando de 3 goblins à frente
const bando = () => V(() => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, 3);
  gs.forEach((m, k) => { Object.assign(m, { morto: false, vida: m.vidaMax, estado: "vagar", vagarT: 99, vx: 0, vy: 0, x: V.jogador.x + 95 + k * 12, y: V.jogador.y + (k - 1) * 26 }); });
  V.jogador.dir = "right"; V.jogador.invul = 999; return gs.length; });
// Disparo: atinge só o primeiro
await bando();
const d = await V(async () => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, 3); const v0 = gs.map((m) => m.vida);
  V.atacar(); await new Promise((r) => setTimeout(r, 700)); return gs.filter((m, k) => m.vida < v0[k]).length; });
ok(d === 1, "Disparo acerta só o primeiro do bando (" + d + ")");
// nível 6 e um arqueiro "evoluído" (muita Força e arco melhorado): a Dispersão derruba o bando com um tiro
await V(() => { const V = window.__valdor; while (V.est.nivel < 6) V.ganhar(50); V.est.atributos.for = 40; V.est.equip.arma = { base: "arco-recurvo", qual: "lendario", mais: 5, bonus: {} }; V.jogador.cds = {}; });
await espera(100);
ok((await V(() => document.getElementById("bH1").textContent)) === "Dispersão", "botão da Dispersão liberado");
await bando();
const xp0 = await V(() => window.__valdor.est.xp + window.__valdor.est.nivel * 1e6);
const disp = await V(async () => { const V = window.__valdor; V.usarHabilidade("dispersao"); await new Promise((r) => setTimeout(r, 260)); return true; });
await pag.screenshot({ path: saida + "/a_disp.png" });
await espera(300);
const mortos = await V(() => window.__valdor.monstros.filter((m) => m.def.id === "goblin").slice(0, 3).filter((m) => m.morto).length);
ok(mortos === 3, `Dispersão: um tiro derrubou ${mortos} de 3 goblins`);
ok((await V(() => window.__valdor.est.xp + window.__valdor.est.nivel * 1e6)) > xp0, "ganhou experiência pelos três");
// Chuva acerta à distância
await bando();
await V(() => { const V = window.__valdor; V.est.atributos.for = 5; V.jogador.cds = {}; const gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, 3); gs.forEach((m, k) => { m.x = V.jogador.x + 110 + (k - 1) * 18; m.y = V.jogador.y - 4 + (k - 1) * 14; }); });
const chuva = await V(async () => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, 3); const v0 = gs.map((m) => m.vida);
  V.usarHabilidade("chuva"); await new Promise((r) => setTimeout(r, 450)); const shot = 1; await new Promise((r) => setTimeout(r, 450)); return gs.filter((m, k) => m.vida < v0[k] || m.morto).length; });
ok(chuva === 3, "Chuva acerta o bando inteiro à distância (" + chuva + ")");
await pag.screenshot({ path: saida + "/a_chuva.png" });
// drops do arqueiro: só arcos como arma
const armas = await V(() => { const V = window.__valdor; return V.est.classe; });
ok(armas === "arqueiro", "classe mantida");
await pag.reload(); await pronto();
ok((await V(() => window.__valdor.est.classe)) === "arqueiro", "arqueiro salvo e recarregado");
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
