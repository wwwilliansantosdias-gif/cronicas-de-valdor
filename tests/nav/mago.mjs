// Mago no navegador: criação, Faísca, Leão de Fogo, Espinhos, Escudo de Gelo e Tornado, com os efeitos na tela.
// PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/mago.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
await pag.goto(base); await pronto("Mago");
const e0 = await V(() => ({ c: window.__valdor.est.classe, arma: window.__valdor.est.equip.arma.base, h: window.__valdor.est.habilidades }));
ok(e0.c === "mago" && e0.arma === "cajado-retorcido" && e0.h.faisca === 1, "mago novo com cajado e Faísca " + JSON.stringify(e0));
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
await V(() => { const V = window.__valdor; while (V.est.nivel < 20) V.ganhar(5000); V.jogador.x = 46 * 32; V.jogador.y = 22 * 32; V.jogador.invul = 999; });
await pag.waitForTimeout(250);
const rot = await V(() => ["bH1", "bH2", "bH3", "bH4"].map((id) => document.getElementById(id).textContent));
ok(rot.join() === "Leão de Fogo,Espinhos de Gelo,Escudo de Gelo,Tornado", "nível 20: os 4 feitiços nos botões " + rot);
// goblins parados com vida alta em lugares conhecidos
const pos = (lista) => V((l) => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, l.length);
  gs.forEach((m, k) => Object.assign(m, { morto: false, vidaMax: 9000, vida: 9000, estado: "vagar", vagarT: 99, vx: 0, vy: 0, x: V.jogador.x + l[k][0], y: V.jogador.y + l[k][1] }));
  V.jogador.dir = "right"; V.jogador.cds = {}; }, lista);
const usar = (id, ms) => V(async ([id, ms]) => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, 3); const v0 = gs.map((m) => m.vida);
  const usou = V.usarHabilidade(id); await new Promise((r) => setTimeout(r, ms)); return { usou, atingidos: gs.filter((m, k) => m.vida < v0[k]).length, efeitos: V.efeitos().length }; }, [id, ms]);
await pos([[60, 0], [110, 0], [160, 0]]);
let r = await usar("faisca", 380); ok(r.usou && r.atingidos === 1 && r.efeitos > 0, "Faísca: só o primeiro, com efeito " + JSON.stringify(r));
await pag.screenshot({ path: saida + "/m_faisca.png" });
await pag.waitForTimeout(500); await pos([[60, 0], [110, 0], [160, 0]]);
r = await usar("leao", 380); ok(r.atingidos === 3, "Leão de Fogo atravessa a fila " + JSON.stringify(r));
await pag.screenshot({ path: saida + "/m_leao.png" });
await pag.waitForTimeout(500); await pos([[40, 0], [-40, 0], [0, 35]]);
r = await usar("espinhos", 380); ok(r.atingidos === 3, "Espinhos de Gelo pegam em volta, inclusive atrás " + JSON.stringify(r));
await pag.screenshot({ path: saida + "/m_espinhos.png" });
await pag.waitForTimeout(500);
const esc = await V(async () => { const V = window.__valdor; V.usarHabilidade("escudo"); await new Promise((r) => setTimeout(r, 450)); return !!V.jogador.escudo; });
ok(esc, "Escudo de Gelo ativo");
await pag.screenshot({ path: saida + "/m_escudo.png" });
await pos([[120, 0], [130, 18], [115, -15]]);
const tor = await V(async () => { const V = window.__valdor, g = V.monstros.filter((m) => m.def.id === "goblin")[0]; let ult = g.vida, n = 0; V.usarHabilidade("tornado");
  for (let t = 0; t < 70; t++) { await new Promise((r) => setTimeout(r, 30)); if (g.vida < ult) { n++; ult = g.vida; } if (t === 25) window.__shot = 1; } return n; });
ok(tor >= 3, "Tornado acerta o mesmo inimigo várias vezes (" + tor + ")");
await pos([[120, 0], [130, 18], [115, -15]]); await V(() => { window.__valdor.jogador.cds = {}; window.__valdor.usarHabilidade("tornado"); }); await pag.waitForTimeout(600);
await pag.screenshot({ path: saida + "/m_tornado.png" });
// escudo reduz o dano recebido
const dano = await V(async () => { const V = window.__valdor, j = V.jogador; j.invul = 0; j.escudo = null; const g = V.monstros.filter((m) => m.def.id === "goblin")[0];
  for (const m of V.monstros) if (m !== g) { m.morto = true; m.mortoEm = performance.now() + 1e6; } // um atacante só
  const medir = async () => { j.vida = 9999; j.invul = 0; Object.assign(g, { x: j.x + 18, y: j.y, estado: "perseguir", cd: {} }); const v0 = j.vida; for (let t = 0; t < 60 && j.vida === v0; t++) await new Promise((r) => setTimeout(r, 50)); return v0 - j.vida; };
  const sem = await medir(); j.escudo = { t: 99, reducao: 0.5 }; await new Promise((r) => setTimeout(r, 700)); const com = await medir(); j.escudo = null; j.invul = 999; return { sem, com }; });
ok(dano.sem > 0 && dano.com > 0 && dano.com < dano.sem, "com escudo o golpe tira menos " + JSON.stringify(dano));
const nome = await V(async () => { const V = window.__valdor; document.getElementById("bS").dispatchEvent(new PointerEvent("pointerdown")); await new Promise((r) => setTimeout(r, 200)); return document.getElementById("caixa").innerText.includes("Magia"); });
ok(nome, "tela de atributos mostra Magia no lugar de Força");
await pag.reload(); await pronto();
ok((await V(() => window.__valdor.est.classe)) === "mago", "mago salvo e recarregado");
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
