// Itens no chão, mochila, equipar e vender. PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/mochila.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const botao = (t) => V((t) => { const b = [...document.querySelectorAll("#caixa button")].find((x) => x.textContent.includes(t)); if (!b || b.disabled) return false; b.click(); return true; }, t);
pag.on("dialog", (d) => d.accept());
await pag.goto(base); await pronto();
await V(() => window.__valdor.entrar("mata-do-javali", "pe-de-lenha"));
// matar o chefe garante um item Raro ou melhor no chão
const caiu = await V(async () => {
  const V = window.__valdor, c = V.monstros.find((m) => m.def.comportamento === "chefe");
  V.jogador.invul = 999; c.vida = 1;
  V.jogador.x = c.x - 30; V.jogador.y = c.y; V.jogador.dir = "right"; c.estado = "vagar"; c.vagarT = 99; c.vx = c.vy = 0;
  for (let i = 0; i < 10 && !c.morto; i++) { V.atacar(); await new Promise((r) => setTimeout(r, 600)); V.jogador.x = c.x - 30; V.jogador.y = c.y; }
  return { morto: c.morto, chao: V.chao.map((x) => x.it.qual) };
});
ok(caiu.morto && caiu.chao.length === 1 && ["raro", "lendario"].includes(caiu.chao[0]), "chefe deixa item Raro+ no chão " + JSON.stringify(caiu));
await pag.screenshot({ path: saida + "/m1.png" });
await V(() => { const V = window.__valdor, c = V.chao[0]; V.jogador.x = c.x; V.jogador.y = c.y; });
await pag.waitForTimeout(200);
ok((await V(() => window.__valdor.chao.length)) === 0 && (await V(() => window.__valdor.est.mochila.length)) === 1, "passar por cima pega o item");
ok((await V(() => document.getElementById("msg").textContent)).startsWith("Pegou:"), "mensagem de item pego");
// mochila
await pag.click("#bI"); await pag.waitForTimeout(150);
ok(await V(() => document.querySelectorAll("#caixa button[data-i]").length === 1), "mochila lista o item");
await V(() => document.querySelector("#caixa button[data-i]").click()); await pag.waitForTimeout(100);
ok(await V(() => document.getElementById("caixa").innerText.includes("Se equipar:")), "mostra comparação com o vestido");
await pag.screenshot({ path: saida + "/m2.png" });
ok(await V(() => { const c = document.getElementById("caixa"); return c.scrollHeight <= c.clientHeight + 2; }), "tela da mochila cabe sem rolar em 844×390");
const antes = await V(() => JSON.stringify(window.__valdor.est.equip));
ok(await botao("Equipar"), "equipa");
const depois = await V(() => ({ equip: JSON.stringify(window.__valdor.est.equip), moch: window.__valdor.est.mochila.length }));
ok(depois.equip !== antes && depois.moch === 1, "item vestido mudou e o antigo voltou para a mochila");
await botao("Fechar");
// vender no mercador
await V(() => window.__valdor.entrar("pe-de-lenha", null));
const ouro0 = await V(() => window.__valdor.est.ouro);
await V(() => { const V = window.__valdor, n = V.mapa.npcs.find((x) => x.tipo === "mercador"); V.jogador.x = n.x * 32 + 16; V.jogador.y = n.y * 32 + 40; V.interagir(); });
ok(await botao("Vender"), "mercador compra item");
ok((await V(() => window.__valdor.est.ouro)) > ouro0 && (await V(() => window.__valdor.est.mochila.length)) === 0, "ouro entrou e item saiu");
await botao("Fechar");
// persiste
await pag.reload(); await pronto();
ok((await V(() => JSON.stringify(window.__valdor.est.equip))) === depois.equip, "equipamento salvo");
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
