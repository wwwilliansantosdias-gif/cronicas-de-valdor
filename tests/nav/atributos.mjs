// Tela de atributos (passo 2). PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/atributos.mjs [pasta-de-capturas]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, pronto, fim } = await abrir();
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const botao = (t) => V((t) => { const b = [...document.querySelectorAll("#caixa button")].find((x) => x.textContent.includes(t) || (x.getAttribute("aria-label") || "").includes(t)); if (!b || b.disabled) return false; b.click(); return true; }, t);
const habilitado = (t) => V((t) => { const b = [...document.querySelectorAll("#caixa button")].find((x) => x.textContent.includes(t) || (x.getAttribute("aria-label") || "").includes(t)); return !!b && !b.disabled; }, t);
pag.on("dialog", (d) => d.accept());

await pag.goto(base); await pronto();
ok((await V(() => window.__valdor.est.autoDistribuir)) === false, "personagem novo: distribuição manual por padrão");
ok((await V(() => document.getElementById("bS").textContent)) === "Atrib.", "sem pontos, botão discreto");
// sobe 3 níveis sem distribuir
await V(() => { window.__valdor.entrar("mata-do-javali", "pe-de-lenha"); window.__valdor.ganhar(2000); });
await pag.waitForTimeout(150);
const livres = await V(() => window.__valdor.est.pontosLivres);
ok(livres > 0 && livres % 3 === 0, "pontos livres acumulam (" + livres + ")");
const hab = await V(() => window.__valdor.est.pontosHab);
ok((await V(() => document.getElementById("bS").textContent)) === `+${livres + hab}`, "botão mostra +N (atributos + habilidades)");
await pag.click("#bS", { force: true }); await pag.waitForTimeout(150);
await pag.screenshot({ path: saida + "/a1.png" });
ok(await V(() => { const r = document.getElementById("caixa").getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }), "tela de atributos cabe sem rolar em 844×390");
const for0 = await V(() => window.__valdor.est.atributos.for);
ok(await botao("+1 Força"), "+1 Força"); 
ok((await V(() => window.__valdor.est.atributos.for)) === for0 + 1 && (await V(() => window.__valdor.est.pontosLivres)) === livres - 1, "Força subiu e ponto foi gasto");
const vida0 = await V(() => window.__valdor.jogador.vida);
ok(await botao("+1 Vitalidade"), "+1 Vitalidade");
ok((await V(() => window.__valdor.jogador.vida)) > vida0, "vida acompanha a Vitalidade");
ok(await botao("Recomendado"), "distribui recomendado");
ok((await V(() => window.__valdor.est.pontosLivres)) === 0, "todos os pontos distribuídos");
ok(!(await habilitado("+1 Força")), "sem pontos, botões de + desligados");
ok(!(await habilitado("Redistribuir")), "fora da cidade não redistribui");
ok(await botao("Distribuir sozinho"), "liga distribuição automática");
await botao("Fechar");
await V(() => window.__valdor.ganhar(3000)); await pag.waitForTimeout(100);
ok((await V(() => window.__valdor.est.pontosLivres)) === 0, "com automático ligado, pontos vão sozinhos");
// redistribuir na cidade
await V(() => { window.__valdor.entrar("pe-de-lenha", null); window.__valdor.est.ouro = 0; });
await pag.click("#bS", { force: true }); await pag.waitForTimeout(100);
ok(!(await habilitado("Redistribuir")), "sem ouro não redistribui");
await botao("Fechar");
await V(() => { window.__valdor.est.ouro = 5000; });
await pag.click("#bS", { force: true }); await pag.waitForTimeout(100);
const antes = await V(() => ({ ouro: window.__valdor.est.ouro, nivel: window.__valdor.est.nivel }));
ok(await botao("Redistribuir"), "redistribui na cidade");
const depois = await V(() => ({ ouro: window.__valdor.est.ouro, livres: window.__valdor.est.pontosLivres, at: window.__valdor.est.atributos }));
ok(depois.ouro === antes.ouro - 25 * antes.nivel, "cobrou 25 × nível");
ok(depois.livres === 3 * (antes.nivel - 1) && Object.values(depois.at).every((v) => v === 5), "todos os pontos voltaram");
await pag.screenshot({ path: saida + "/a2.png" });
await botao("Fechar");
// persiste
await pag.reload(); await pronto();
ok((await V(() => window.__valdor.est.pontosLivres)) === depois.livres, "pontos livres salvos");
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
