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
ok(await V(() => { const r = document.getElementById("caixa").getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }), "tela da mochila cabe sem rolar em 844×390");
const antes = await V(() => JSON.stringify(window.__valdor.est.equip));
const vazioAntes = await V(() => { const V = window.__valdor, sel = V.est.mochila[0]; return sel ? Object.entries(V.est.equip).filter(([, v]) => v === null).map(([k]) => k) : []; });
await V(() => { window.__valdor.est.nivel = 9; }); // o item do chefe pode exigir até 2 níveis acima
await toque("#caixa button[data-i]");
ok(await toque("#caixa button", "Equipar"), "toca em Equipar");
const depois = await V(() => ({ equip: JSON.stringify(window.__valdor.est.equip), moch: window.__valdor.est.mochila.length, msg: document.getElementById("msg").textContent, vazios: Object.entries(window.__valdor.est.equip).filter(([, v]) => v === null).map(([k]) => k) }));
const ocupouVazio = depois.vazios.length < vazioAntes.length;
ok(depois.equip !== antes && depois.moch === (ocupouVazio ? 0 : 1), `item vestido mudou e o antigo voltou para a mochila (${ocupouVazio ? "espaço estava vazio" : "troca"})`);
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
// prova no boneco: escolher um item da mochila muda o boneco e mostra a diferença; equipar sobe o Poder do topo
await V(() => { const V = window.__valdor; V.est.equip.capacete = { base: "gorro-couro", qual: "comum", mais: 0, bonus: {} }; V.est.mochila = [{ base: "capuz", qual: "lendario", mais: 2, bonus: { vit: 2 } }]; });
await toque("#bI"); await pag.waitForTimeout(250);
const previa = () => V(() => Array.from(document.getElementById("previa").getContext("2d").getImageData(0, 0, 64, 64).data).filter((x, i) => i % 4 === 3 && x > 0).length + "|" + Array.from(document.getElementById("previa").getContext("2d").getImageData(0, 0, 64, 64).data).slice(0, 4096).join(""));
const pv0 = await V(() => { const c = document.getElementById("previa"); return c.toDataURL(); });
await toque("#caixa button[data-i]"); await pag.waitForTimeout(250);
const pv1 = await V(() => document.getElementById("previa").toDataURL());
ok(pv0 !== pv1, "boneco prova o elmo antes de equipar");
ok(await V(() => /\+\d+/.test(document.querySelector("#caixa h3").innerText)), "título mostra o ganho de Poder ao provar");
await pag.screenshot({ path: saida + "/m4.png" });
const hud0 = await V(() => +document.getElementById("nv").textContent.match(/Poder (\d+)/)[1]);
await toque("#caixa button", "Equipar"); await toque("#caixa button", "Fechar"); await pag.waitForTimeout(200);
const hud1 = await V(() => +document.getElementById("nv").textContent.match(/Poder (\d+)/)[1]);
ok(hud1 > hud0, `Poder no topo subiu ao equipar (${hud0} → ${hud1})`);
// qualidade muda a aparência da mesma peça (tinta) e os itens têm ícone
await V(() => { window.__valdor.est.equip.peitoral = { base: "cota-malha", qual: "lendario", mais: 0, bonus: {} }; });
await pag.waitForTimeout(150);
ok(px1 !== await pixelsJogador(), "Cota de malha Lendária tem cor diferente da Comum");
await toque("#bI");
ok(await V(() => document.querySelectorAll("#caixa img.ic").length >= 4), "ícones dos itens na mochila");
await toque("#caixa button", "Fechar");
// tirar uma peça vestida
await toque("#bI"); await toque("#caixa [data-e='capacete']");
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
// espaços novos e brilho do +N
await V(() => { const V = window.__valdor; V.entrar("mata-do-javali", "pe-de-lenha"); V.jogador.invul = 0; V.jogador.dir = "down"; V.est.nivel = 29; V.est.equip.escudo = null; V.est.equip.capa = null; });
await pag.waitForTimeout(200);
const semEscudo = await pixelsJogador();
await V(() => { const V = window.__valdor; V.est.equip.escudo = { base: "escudo-cruzado", qual: "comum", mais: 0, bonus: {} }; V.est.equip.capa = { base: "capa-lisa", qual: "comum", mais: 0, bonus: {} }; });
await pag.waitForTimeout(200);
ok(semEscudo !== await pixelsJogador(), "escudo e capa aparecem no personagem");
const luzMao = () => V(() => { const c = document.getElementById("tela"), x = c.getContext("2d"), j = window.__valdor.jogador;
  const cam = { x: Math.max(0, Math.min(window.__valdor.mapa.w * 32 - c.width, j.x - c.width / 2)), y: Math.max(0, Math.min(window.__valdor.mapa.h * 32 - c.height, j.y - 30 - c.height / 2)) };
  const d = x.getImageData(Math.round(j.x + 10 - cam.x) - 12, Math.round(j.y - 26 - cam.y) - 12, 24, 24).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s; });
// etapa 12: o reforço liga o brilho (contorno a partir de +4) até numa arma Comum; a raridade muda a cor da arma
await V(() => { window.__valdor.est.equip.arma = { base: "machado", qual: "comum", mais: 0, bonus: {} }; });
await pag.waitForTimeout(250); const luz0 = await luzMao();
await V(() => { window.__valdor.est.equip.arma.mais = 5; });
await pag.waitForTimeout(250); const luz5 = await luzMao();
ok(luz5 > luz0 * 1.05, `arma Comum +5 brilha (${luz0} → ${luz5})`);
await V(() => { window.__valdor.est.equip.arma = { base: "machado", qual: "epico", mais: 0, bonus: {} }; });
await pag.waitForTimeout(250); const luzEp = await luzMao();
ok(luzEp !== luz0, `arma Épica tem outra cor (${luz0} → ${luzEp})`);
// chave de efeitos no menu desliga o brilho
await V(() => { window.__valdor.est.equip.arma = { base: "machado", qual: "lendario", mais: 12, bonus: {} }; });
await pag.waitForTimeout(250); const luzL = await luzMao();
await V(() => document.getElementById("bM").dispatchEvent(new PointerEvent("pointerdown"))); await pag.waitForTimeout(150);
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent.startsWith("Efeitos de brilho")).click());
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Fechar").click()); await pag.waitForTimeout(250);
const luzOff = await luzMao();
ok(luzOff < luzL, `efeitos desligados pelo menu: menos brilho (${luzL} → ${luzOff})`);
await V(() => document.getElementById("bM").dispatchEvent(new PointerEvent("pointerdown"))); await pag.waitForTimeout(150);
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent.startsWith("Efeitos de brilho")).click());
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Fechar").click());
await pag.screenshot({ path: saida + "/m5.png" });
// forja até +12 (etapa 12): +11 -> +12 com 10% de chance, custo da tabela; no +12 não melhora mais
await V(() => { const V = window.__valdor; V.entrar("pe-de-lenha", null); V.est.ouro = 1e6; V.est.fragmentos = 1e4; V.est.equip.arma = { base: "machado", qual: "comum", mais: 11, bonus: {} }; });
const forja = await V(async () => { const V = window.__valdor, n = V.mapa.npcs.find((x) => x.tipo === "ferreiro"); V.jogador.x = n.x * 32 + 16; V.jogador.y = n.y * 32 + 40; V.interagir();
  await new Promise((r) => setTimeout(r, 150)); const bt = (t) => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent.includes(t));
  bt("Arma:").click(); await new Promise((r) => setTimeout(r, 150)); const texto = document.getElementById("caixa").innerText;
  let tentativas = 0; while (V.est.equip.arma.mais < 12 && tentativas < 200) { bt("Melhorar para +12").click(); tentativas++; await new Promise((r) => setTimeout(r, 5)); }
  await new Promise((r) => setTimeout(r, 100)); return { texto, mais: V.est.equip.arma.mais, tentativas, fim: document.getElementById("caixa").innerText.includes("máximo") }; });
ok(forja.texto.includes("+12") && forja.texto.includes("10%") && forja.mais === 12 && forja.fim, `forja vai até +12 (10% de chance, ${forja.tentativas} tentativas) e para no máximo`);
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
