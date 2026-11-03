// Telas cabem em celulares deitados de vários tamanhos (inclusive com a barra do navegador).
// PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/telas.mjs [pasta]
import { abrir } from "./servidor.mjs";
const saida = process.argv[2] || "/tmp";
let falhas = 0;
for (const [w, h] of [[844, 390], [740, 320], [667, 300], [568, 300]]) {
  const { pag, erros, ok, base, pronto } = await abrir({ largura: w, altura: h });
  const nav = pag.context().browser();
  await pag.goto(base);
  const cabe = () => pag.evaluate(() => { const c = document.getElementById("caixa"), r = c.getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && c.scrollWidth <= c.clientWidth + 2 && c.scrollHeight <= c.clientHeight + 2; });
  const verifica = async (nome) => { const c = await cabe(); console.log((c ? "ok   " : "FALHA") + ` ${w}×${h}: ${nome}`); if (!c) falhas++; };
  // personagem novo: classe e aparência
  await pag.waitForFunction(() => document.getElementById("caixa").innerText.includes("Novo personagem")); await verifica("Novo personagem");
  await pag.evaluate(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Guerreiro").click());
  await pag.waitForFunction(() => !!document.querySelector('button[data-ap="pele"]')); await pag.waitForTimeout(150); await verifica("Aparência (criação)");
  await pronto();
  await pag.evaluate(() => { const V = window.__valdor, E = V.est; V.ganhar(4000); E.mochila = [{ base: "capuz", qual: "raro", mais: 1, bonus: { vit: 2 } }, { base: "luvas", qual: "comum", mais: 0, bonus: {} }]; });
  await pag.click("#bI", { force: true }); await pag.waitForTimeout(200); await verifica("Personagem/Equipamento");
  await pag.evaluate(() => document.querySelector("#caixa button[data-i='0']").click()); await pag.waitForTimeout(150); await verifica("prova de item");
  for (const a of ["visual", "atrib", "hab"]) { await pag.evaluate((a) => document.querySelector(`#caixa button[data-aba='${a}']`).click(), a); await pag.waitForTimeout(150); await verifica(a); }
  await pag.screenshot({ path: `${saida}/tela_${w}x${h}.png` });
  const btn = await pag.evaluate(() => ["bA", "bH1", "bH2", "bH3", "bH4", "bP", "bS", "bI", "bM", "joy"].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0; }));
  console.log((btn ? "ok   " : "FALHA") + ` ${w}×${h}: botões dentro da tela`); if (!btn) falhas++;
  if (erros.length) { console.log("FALHA erros: " + erros.join("|")); falhas++; }
  await nav.close();
}
console.log(falhas ? `${falhas} falha(s)` : "tudo certo"); process.exit(falhas ? 1 : 0);
