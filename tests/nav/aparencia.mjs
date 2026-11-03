// Aparência do herói: escolha ao criar, troca na aba Aparência, salva e recarrega, aparece no boneco.
// PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/aparencia.mjs [pasta]
import { abrir } from "./servidor.mjs";
const { pag, erros, ok, base, fim } = await abrir({ toque: true });
const saida = process.argv[2] || "/tmp";
const V = (fn, a) => pag.evaluate(fn, a);
const toque = async (sel) => { const b = await pag.$(sel); await b.tap({ force: true }); await pag.waitForTimeout(120); };
const texto = (campo) => V((c) => document.querySelector(`button[data-ap="${c}"]`).parentElement.querySelector("b").textContent, campo);

await pag.goto(base);
await pag.waitForFunction(() => document.getElementById("caixa").innerText.includes("Novo personagem"));
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Arqueiro").click());
await pag.waitForFunction(() => !!document.querySelector('button[data-ap="pele"]'));
ok(true, "depois da classe vem a tela de aparência");
// escolhe: pele até "Negra", cabelo até "Black power", barba "Cheia"
const ate = async (campo, nome) => { for (let i = 0; i < 30 && (await texto(campo)) !== nome; i++) await toque(`button[data-ap="${campo}"][data-p="1"]`); return texto(campo); };
ok((await ate("pele", "Negra")) === "Negra", "pele escolhida com toques");
ok((await ate("cabelo", "Black power")) === "Black power", "cabelo escolhido");
await ate("barba", "Cheia");
await pag.screenshot({ path: saida + "/ap_criacao.png" });
await V(() => [...document.querySelectorAll("#caixa button")].find((b) => b.textContent === "Começar").click());
await pag.waitForFunction(() => document.body.dataset.pronto === "1");
const ap = await V(() => window.__valdor.est.aparencia);
ok(ap.pele === "black" && ap.cabelo === "afro" && ap.barba === "cheia", "aparência entra no personagem novo " + JSON.stringify(ap));
// aba Aparência: troca a cor do cabelo
await toque("#bI"); await V(() => document.querySelector('button[data-aba="visual"]').click()); await pag.waitForTimeout(400);
const cor0 = await texto("cor_cabelo");
await toque('button[data-ap="cor_cabelo"][data-p="1"]'); await pag.waitForTimeout(400);
ok((await texto("cor_cabelo")) !== cor0 && (await V(() => window.__valdor.est.aparencia.cor_cabelo)) !== ap.cor_cabelo, "cor do cabelo trocada na aba Aparência e guardada");
await pag.screenshot({ path: saida + "/ap_aba.png" });
const salvo = await V(() => window.__valdor.est.aparencia);
await pag.reload(); await pag.waitForFunction(() => document.body.dataset.pronto === "1");
ok(JSON.stringify(await V(() => window.__valdor.est.aparencia)) === JSON.stringify(salvo), "aparência salva e recarregada");
// save adulterado: id desconhecido volta ao padrão sem perder o personagem
await V(() => { const s = JSON.parse(localStorage.getItem("valdor-save")); s.aparencia.cabelo = "inexistente"; s.ouro = 77; localStorage.setItem("valdor-save", JSON.stringify(s)); });
await pag.reload(); await pag.waitForFunction(() => document.body.dataset.pronto === "1");
const r = await V(() => ({ ouro: window.__valdor.est.ouro, cab: window.__valdor.est.aparencia.cabelo, pele: window.__valdor.est.aparencia.pele }));
ok(r.ouro === 77 && r.cab === "plain" && r.pele === "black", "id desconhecido volta ao padrão, resto mantido " + JSON.stringify(r));
ok(erros.length === 0, "sem erros de console: " + erros.join("|"));
await fim();
