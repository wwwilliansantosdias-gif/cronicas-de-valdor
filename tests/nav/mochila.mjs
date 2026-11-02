// Itens no chão, mochila, equipar e vender. PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/mochila.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir({ toque: true });
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const botao = (t) => V((t) => { const b = [...document.querySelectorAll("#caixa button")].find((x) => x.textContent.includes(t)); if (!b || b.disabled) return false; b.click(); return true; }, t);
pag.on("dialog", (d) => d.accept());
// toque de verdade (como no celular) no centro do elemento
const toque = async (sel, filtro = null) => {
  const r = await V(([s, f]) => { const e = [...document.querySelectorAll(s)].find((x) => !f || x.textContent.includes(f)); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, [sel, filtro]);
  if (!r) return false; await pag.touchscreen.tap(r[0], r[1]); await pag.waitForTimeout(200); return true;
};
// "assinatura" dos pixels do personagem na tela
const pixelsJogador = () => V(() => { const c = document.getElementById("tela"), x = c.getContext("2d"), j = window.__valdor.jogador;
  const cam = { x: Math.max(0, Math.min(window.__valdor.mapa.w * 32 - c.width, j.x - c.width / 2)), y: Math.max(0, Math.min(window.__valdor.mapa.h * 32 - c.height, j.y - 30 - c.height / 2)) };
  return Array.from(x.getImageData(Math.round(j.x - 32 - cam.x), Math.round(j.y - 60 - cam.y), 64, 64).data).join(","); });
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
// mochila (só com toques)
ok(await toque("#bI"), "toca em Mochila");
ok(await V(() => document.querySelectorAll("#caixa button[data-i]").length === 1), "mochila lista o item");
ok(await toque("#caixa button[data-i]"), "toca no item");
ok(await V(() => document.getElementById("caixa").innerText.includes("Se equipar:")), "mostra comparação com o vestido");
await pag.screenshot({ path: saida + "/m2.png" });
ok(await V(() => { const c = document.getElementById("caixa"); return c.scrollHeight <= c.clientHeight + 2; }), "tela da mochila cabe sem rolar em 844×390");
const antes = await V(() => JSON.stringify(window.__valdor.est.equip));
await V(() => { window.__valdor.est.nivel = 9; }); // o item do chefe pode exigir até 2 níveis acima
await toque("#caixa button[data-i]");
ok(await toque("#caixa button", "Equipar"), "toca em Equipar");
const depois = await V(() => ({ equip: JSON.stringify(window.__valdor.est.equip), moch: window.__valdor.est.mochila.length, msg: document.getElementById("msg").textContent }));
ok(depois.equip !== antes && depois.moch === 1, "item vestido mudou e o antigo voltou para a mochila");
ok(depois.msg.startsWith("Equipou:"), "avisa que equipou");
await toque("#caixa button", "Fechar");
// aparência: vestir uma cota de malha muda os pixels do personagem
await V(() => { const V = window.__valdor; V.est.nivel = 5; V.est.equip.peitoral = { base: "gibao-couro", qual: "comum", mais: 0, bonus: {} }; V.est.mochila = [{ base: "cota-malha", qual: "comum", mais: 0, bonus: {} }]; V.jogador.invul = 0; });
await pag.waitForTimeout(150);
const px0 = await pixelsJogador();
await toque("#bI"); await toque("#caixa button[data-i]"); await toque("#caixa button", "Equipar"); await toque("#caixa button", "Fechar");
await pag.waitForTimeout(150);
const px1 = await pixelsJogador();
ok((await V(() => window.__valdor.est.equip.peitoral.base)) === "cota-malha" && px0 !== px1, "vestir a cota de malha muda a aparência do personagem");
await pag.screenshot({ path: saida + "/m3.png" });
// tirar uma peça vestida
await toque("#bI"); await toque("#caixa tr[data-e='capacete']");
ok(await toque("#caixa button", "Tirar"), "toca em Tirar");
ok((await V(() => window.__valdor.est.equip.capacete)) === null, "capacete foi para a mochila");
const pecaVestida = await V(() => JSON.stringify(window.__valdor.est.equip));
await toque("#caixa button", "Fechar");
// vender no mercador
await V(() => window.__valdor.entrar("pe-de-lenha", null));
const ouro0 = await V(() => window.__valdor.est.ouro), qtd0 = await V(() => window.__valdor.est.mochila.length);
await V(() => { const V = window.__valdor, n = V.mapa.npcs.find((x) => x.tipo === "mercador"); V.jogador.x = n.x * 32 + 16; V.jogador.y = n.y * 32 + 40; V.interagir(); });
ok(await botao("Vender"), "mercador compra item");
ok((await V(() => window.__valdor.est.ouro)) > ouro0 && (await V(() => window.__valdor.est.mochila.length)) === qtd0 - 1, "ouro entrou e item saiu");
await botao("Fechar");
// persiste
await pag.reload(); await pronto();
ok((await V(() => JSON.stringify(window.__valdor.est.equip))) === pecaVestida, "equipamento salvo");
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
