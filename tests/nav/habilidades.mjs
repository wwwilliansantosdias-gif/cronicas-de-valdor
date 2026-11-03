// Habilidades das regiões 2 e 3 no navegador: Investida avança, Rajada dispara 3 flechas, Perfurante atravessa a fila.
// PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/habilidades.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const subir = (n) => V((n) => { const V = window.__valdor; while (V.est.nivel < n) V.ganhar(5000); V.jogador.cds = {}; V.jogador.invul = 999; }, n);
// coloca n goblins em fila à direita, com vida alta para contar os acertos
const fila = (n, dx = 70, passo = 40) => V(([n, dx, passo]) => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, n);
  gs.forEach((m, k) => Object.assign(m, { morto: false, vidaMax: 5000, vida: 5000, estado: "vagar", vagarT: 99, vx: 0, vy: 0, x: V.jogador.x + dx + k * passo, y: V.jogador.y }));
  V.jogador.dir = "right"; return gs.length; }, [n, dx, passo]);

await pag.goto(base); await pronto("Guerreiro");
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
await subir(20); await pag.waitForTimeout(250); // os rótulos dos botões mudam no quadro seguinte
const botoes = await V(() => ["bH3", "bH4"].map((id) => document.getElementById(id).textContent));
ok(botoes[0] === "Terremoto" && botoes[1] === "Investida", "nível 20: Terremoto e Investida nos botões " + botoes);
await V(() => { const V = window.__valdor; V.jogador.x = 46 * 32; V.jogador.y = 22 * 32; });
await fila(1, 100);
const inv = await V(async () => { const V = window.__valdor, x0 = V.jogador.x, g = V.monstros.find((m) => m.def.id === "goblin"); V.usarHabilidade("investida");
  await new Promise((r) => setTimeout(r, 700)); return { andou: V.jogador.x - x0, acertou: g.vida < g.vidaMax }; });
ok(inv.andou > 60 && inv.acertou, "Investida avança e acerta à frente " + JSON.stringify(inv));
await pag.screenshot({ path: saida + "/h_investida.png" });

await V(() => localStorage.clear()); await pag.reload(); await pronto("Arqueiro");
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
await subir(20);
await V(() => { const V = window.__valdor; V.jogador.x = 46 * 32; V.jogador.y = 22 * 32; });
await fila(1, 90);
const acertos = await V(async () => { const V = window.__valdor, g = V.monstros.find((m) => m.def.id === "goblin"); let ult = g.vida, n = 0; V.usarHabilidade("rajada");
  for (let t = 0; t < 40; t++) { await new Promise((r) => setTimeout(r, 30)); if (g.vida < ult) { n++; ult = g.vida; } } return n; });
ok(acertos === 3, "Rajada: 3 flechas no mesmo alvo (" + acertos + ")");
await V(() => { window.__valdor.jogador.cds = {}; });
await fila(3, 70, 50);
const perf = await V(async () => { const V = window.__valdor, gs = V.monstros.filter((m) => m.def.id === "goblin").slice(0, 3); V.usarHabilidade("perfurante");
  await new Promise((r) => setTimeout(r, 300)); const p = new Promise((r) => setTimeout(r, 500)); await p; return gs.filter((m) => m.vida < m.vidaMax).length; });
ok(perf === 3, "Perfurante atravessa os 3 da fila (" + perf + ")");
await pag.screenshot({ path: saida + "/h_perfurante.png" });
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
