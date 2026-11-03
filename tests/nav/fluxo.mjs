// Fluxo da região 1 no navegador. PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/fluxo.mjs [pasta-de-capturas]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
await pag.goto(base); await pronto();
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
t = await perto("ferreiro");
ok(await botao("Arma: Espada longa"), "escolhe a espada no ferreiro");
ok(await botao("Melhorar para +1"), "melhora a espada (+1 sempre dá certo)");
ok(await V(() => document.getElementById("caixa").innerText.includes("Sucesso")), "mostra o resultado");
await fechar();
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
    V.jogador.x = m.x - 20; V.jogador.y = m.y; V.jogador.dir = "right"; V.jogador.invul = 99; V.jogador.cds = {};
    for (let k = 0; k < 20 && !m.morto; k++) { V.atacar(); await new Promise((r) => setTimeout(r, 560)); V.jogador.x = m.x - 20; V.jogador.y = m.y; }
    if (m.morto) n++;
  }
  return n;
});
ok(mortos === 4, "há 5 javalis na mata; matamos 4 (" + mortos + ")");
const prog = await V(() => ({ p: window.__valdor.est.missoes.javalis.progresso, mortos: window.__valdor.monstros.filter((m) => m.def.id === "javali" && m.morto).length }));
ok(prog.p === Math.min(6, prog.mortos) && prog.p >= 4, "progresso da missão = javalis mortos (bando conta junto) " + JSON.stringify(prog));
await V(() => { if (window.__valdor.est.missoes.javalis.estado === "ativa") { window.__valdor.est.missoes.javalis.progresso = 6; window.__valdor.est.missoes.javalis.estado = "pronta"; } window.__valdor.entrar("pe-de-lenha", null); });
const ouroAntes = await V(() => window.__valdor.est.ouro);
await perto("quadro"); ok(await botao("Entregar: Trilha limpa"), "entrega missão"); await fechar();
ok((await V(() => window.__valdor.est.ouro)) === ouroAntes + 30, "recompensa de ouro recebida");
// portal libera no nível 10
await V(() => { window.__valdor.est.nivel = 9; }); t = await perto("portal"); ok(t.includes("selado"), "nível 9: selado"); await fechar();
await V(() => { window.__valdor.est.nivel = 10; }); await perto("portal");
ok((await V(() => window.__valdor.mapa.id)) === "veio-fundo", "nível 10: portal leva a Veio-Fundo");
// regiões 2 e 3: portais de ida e volta, áreas de caça com bandos e chefes
const portal = (para) => V((p) => { const V = window.__valdor, n = V.mapa.portais.find((x) => x.para === p); V.jogador.x = n.x * 32 + 16; V.jogador.y = n.y * 32 + 40; V.jogador.invul = 99; V.interagir(); return document.getElementById("caixa").innerText; }, para);
t = await portal("ruinas"); ok(t.includes("selado") && t.includes("nível 20"), "Veio-Fundo: portal das Ruínas selado no nível 10"); await fechar();
await V(() => { window.__valdor.est.nivel = 20; }); await portal("ruinas");
ok((await V(() => window.__valdor.mapa.id)) === "cinzaltar", "nível 20: portal leva a Cinzaltar");
await portal("caverna"); ok((await V(() => window.__valdor.mapa.id)) === "veio-fundo", "Cinzaltar: portal volta a Veio-Fundo");
await portal("floresta"); ok((await V(() => window.__valdor.mapa.id)) === "pe-de-lenha", "Veio-Fundo: portal volta a Pé-de-Lenha");
for (const [area, chefe, tipos] of [["galerias-rasas", "golem-do-veio", ["morcego", "gosma", "minhoca", "golem"]], ["campo-das-lapides", "rei-esqueletico", ["esqueleto", "zumbi", "fantasma", "olho-voador"]]]) {
  await V((a) => window.__valdor.entrar(a, null), area);
  const r = await V(() => ({ n: window.__valdor.monstros.length, ids: [...new Set(window.__valdor.monstros.map((m) => m.def.id))] }));
  ok(r.n >= 30 && r.ids.includes(chefe) && tipos.every((x) => r.ids.includes(x)), area + ": " + r.n + " monstros, " + r.ids.join(", "));
  await pag.waitForTimeout(400); await pag.screenshot({ path: saida + "/" + area + ".png" });
}
await V(() => { window.__valdor.est.nivel = 10; window.__valdor.entrar("pe-de-lenha", null); });
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
await fim();
