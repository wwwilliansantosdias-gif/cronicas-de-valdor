// Página de aprovação dos equipamentos (etapa 11): 15 arcos desenhados, reforço e chave de efeitos funcionando,
// imagens recoloridas só uma vez (não a cada quadro), cabe no celular deitado sem rolagem lateral.
// PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/equipamentos.mjs [pasta]
import { abrir } from "./servidor.mjs";
const saida = process.argv[2] || "/tmp";
let falhas = 0;
for (const [w, h] of [[844, 390], [568, 300]]) {
  const { pag, erros, ok: ok0, base } = await abrir({ largura: w, altura: h, toque: true });
  const ok = (c, m) => { ok0(c, m); if (!c) falhas++; };
  const nav = pag.context().browser();
  await pag.goto(base + "equipamentos/");
  await pag.waitForFunction(() => document.body.dataset.pronto === "1", null, { timeout: 30000 });
  await pag.waitForTimeout(900);
  const E = (fn, a) => pag.evaluate(fn, a);
  const r = await E(() => {
    const cs = [...document.querySelectorAll(".cel")];
    const desenhado = (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
    return { celulas: cs.length, cheios: cs.every((c) => desenhado(c.querySelector(".parado")) > 300 && desenhado(c.querySelector(".atirando")) > 300),
      nomes: cs.map((c) => getComputedStyle(c.querySelector(".nome")).color), largura: document.documentElement.scrollWidth <= innerWidth + 1,
      dentro: cs.every((c) => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll("canvas")].every((v) => { const q = v.getBoundingClientRect(); return q.left >= r.left - 1 && q.right <= r.right + 1; }); }) };
  });
  ok(r.celulas === 15 && r.cheios, `${w}×${h}: 15 arqueiros desenhados (parado e atirando)`);
  ok(new Set(r.nomes).size === 5, `${w}×${h}: nome de cada raridade na sua cor`);
  ok(r.largura && r.dentro, `${w}×${h}: sem rolagem para o lado e desenhos dentro dos cartões`);
  const rec0 = await E(() => window.__equip.recoloridas()); await pag.waitForTimeout(800);
  ok((await E(() => window.__equip.recoloridas())) === rec0, `${w}×${h}: imagens recoloridas uma vez só (${rec0}), não a cada quadro`);
  ok((await E(() => window.__equip.efeitos("comum").contorno)) === 0, "Comum +0 sem contorno");
  // reforço +12 pelo controle deslizante (toque)
  await E(() => { const s = document.getElementById("reforco"); s.value = 12; s.dispatchEvent(new Event("input")); });
  await pag.waitForTimeout(1200);
  const p12 = await E(() => window.__equip.particulas());
  ok(p12 > 0 && (await E(() => window.__equip.efeitos("comum").aura)) > 0, `${w}×${h}: +12 liga partículas (${p12}) e aura até no Comum`);
  ok((await E(() => document.querySelector(".cel .nome").textContent)).includes("+12"), "nome mostra o reforço");
  // chave de efeitos
  await pag.tap("#efeitos"); await pag.waitForTimeout(500);
  const off = await E(() => ({ p: window.__equip.particulas(), e: Object.values(window.__equip.efeitos("lendario")).every((v) => v === 0) }));
  ok(off.p === 0 && off.e, `${w}×${h}: efeitos desligados: nada de brilho nem partículas`);
  await pag.tap("#efeitos"); await pag.waitForTimeout(300);
  await pag.screenshot({ path: `${saida}/equipamentos_${w}x${h}.png`, fullPage: true });
  const cred = await E(() => document.querySelectorAll("#creditos li").length);
  ok(cred >= 5, `créditos listados na página (${cred})`);
  ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
  await nav.close();
}
console.log(falhas ? `${falhas} falha(s)` : "tudo certo"); process.exit(falhas ? 1 : 0);
