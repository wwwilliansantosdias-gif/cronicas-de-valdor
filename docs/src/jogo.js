import { lerMapaTexto, gerarMapa, TILE, bloqueadoTile } from "./mapa.js";
import { novoEstado, ganharXp, portalLiberado, aoMorrer, xpParaProximo } from "./progresso.js";
import { carregar, guardar, apagar } from "./salvar.js";
import { criarMonstro, atualizarMonstro, atingir, danoHabilidade, recargaHabilidade, mover, direcaoDe } from "./combate.js";
import { sortearDrop, nomeItem, precoVenda, pegar, equipar, desequipar, descartar, vender, impedimento } from "./itens.js";
import { derivados, valoresItem, baseItem, qualidade, aoSubir, distribuirRecomendado, distribuir, redistribuir, custoRedistribuir, gastos, desbloquearHabilidades, melhorarHabilidade } from "./personagem.js";

const $ = (id) => document.getElementById(id);
const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const texto = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.text(); });
const imagem = (u) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("imagem " + u)); i.src = u; });
const LINHA = { up: 0, left: 1, down: 2, right: 3 };

const tela = $("tela"), ctx = tela.getContext("2d");
let Z = 2, VW = 0, VH = 0;
function ajustar() {
  Z = Math.max(1, Math.floor(Math.min(innerWidth / 384, innerHeight / 192)));
  VW = Math.floor(innerWidth / Z); VH = Math.floor(innerHeight / Z);
  tela.width = VW; tela.height = VH; tela.style.width = VW * Z + "px"; tela.style.height = VH * Z + "px";
  ctx.imageSmoothingEnabled = false;
}
addEventListener("resize", ajustar); ajustar();

let D, IMG, EST, MAPAS = {}, mapa, jogador, monstros = [], chao = [], avisoCheia = 0, chefeDef, msgT = 0, parado = false, ultimoSave = 0;
const MSTR = {};

function msg(t, s = 2.4) { $("msg").style.color = ""; $("msg").textContent = t; $("msg").classList.add("on"); msgT = s; }
function salvar() { guardar(localStorage, EST); }

async function iniciar() {
  const [regioes, mons, itens, missoes, mostr, prog, classes, habs] = await Promise.all(["dados/regioes.json", "dados/monstros.json", "dados/itens.json", "dados/missoes.json", "mostruario/mostruario.json", "dados/progressao.json", "dados/classes.json", "dados/habilidades.json"].map(json));
  D = { regioes: regioes.regioes, mapasTxt: regioes.mapas, monstros: Object.fromEntries(mons.monstros.map((m) => [m.id, m])), itens, missoes: missoes.missoes,
    P: prog, classes: Object.fromEntries(classes.classes.map((c) => [c.id, c])), hab: Object.fromEntries(habs.habilidades.map((h) => [h.id, h])), porGrau: habs.por_grau };
  for (const m of mostr.monstros) MSTR[m.id] = m;
  const arq = ["forest_tiles", "dirt", "signs", "house", "soldier", "soldier_altcolor", "princess"];
  IMG = Object.fromEntries(await Promise.all(arq.map(async (n) => [n, await imagem(`assets/${n}.png`)])));
  // peças do personagem: corpo, cabeça e o visual de cada item (camadas empilhadas na hora)
  const pecas = new Set();
  for (const c of Object.values(itens.corpo)) if (c.base) for (const a of ["walk", "slash", "thrust"]) { pecas.add(`${c.base}/${a}.png`); pecas.add(`${c.cabeca}/${a}.png`); }
  for (const it of itens.itens) for (const [k, v] of Object.entries(it.visual || {})) if (k !== "grande") pecas.add(v);
  await Promise.all([...pecas].map(async (f) => { IMG[f] = await imagem("assets/pecas/" + f); }));
  const usados = new Set();
  for (const id in D.monstros) { const s = MSTR[D.monstros[id].sprite]; for (const k of ["andar", "ataque"]) if (s[k]) usados.add(s[k].file); }
  for (const f of usados) IMG[f] = await imagem("mostruario/" + f);
  for (const [id, f] of Object.entries(D.mapasTxt)) MAPAS[id] = gerarMapa(lerMapaTexto(await texto(f)));
  EST = carregar(D.P, D.itens, localStorage, Object.keys(MAPAS)) || novoEstado(D.P, D.itens);
  if (EST.autoDistribuir && EST.pontosLivres > 0) distribuirRecomendado(D.P, EST, D.classes[EST.classe].recomendado);
  desbloquearHabilidades(EST, habsDaClasse()); // saves anteriores ganham as habilidades que o nível já libera
  jogador = { x: 0, y: 0, dir: "down", vida: 0, morto: false, andando: false, tAnim: 0, golpe: -1, cds: {}, invul: 0, veneno: null };
  entrar(EST.mapa, null);
  jogador.vida = stats().vidaMax;
  document.body.dataset.pronto = "1";
  requestAnimationFrame(quadro);
}

function entrar(id, origem) {
  EST.mapa = id; mapa = MAPAS[id]; monstros = []; chao = [];
  let p = mapa.inicio;
  if (origem) { const s = mapa.saidas.find((x) => x.destino === origem); if (s) p = s.entrada; }
  if (!origem && mapa.zonaSegura) p = { x: 16, y: 14 };
  if (mapa.zonaSegura && D && EST.atributos) jogador.vida = stats().vidaMax; // a cidade restaura a vida
  jogador.x = p.x * TILE + 16; jogador.y = p.y * TILE + 28;
  for (const s of mapa.spawns) monstros.push(criarMonstro(D.monstros[s.tipo], s.x * TILE + 16, s.y * TILE + 28));
  if (mapa.chefe) monstros.push(criarMonstro(D.monstros[mapa.chefe.tipo], mapa.chefe.x * TILE + 16, mapa.chefe.y * TILE + 28));
  salvar();
}

// ---------- entrada ----------
const teclas = new Set(), joy = { x: 0, y: 0, id: null };
addEventListener("keydown", (e) => { const k = e.key.toLowerCase(); teclas.add(k); if (k === " ") atacar(); if (k === "1") usarHabilidade("estocada"); if (k === "2") usarHabilidade("giro"); if (k === "e") interagir(); if (k === "q") usarPocao(); });
addEventListener("keyup", (e) => teclas.delete(e.key.toLowerCase()));
const joyEl = $("joy"), knob = $("knob");
function joyMove(e) {
  const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const n = Math.hypot(dx, dy), max = r.width / 2;
  if (n > max) { dx = dx / n * max; dy = dy / n * max; }
  joy.x = dx / max; joy.y = dy / max;
  knob.style.left = r.width / 2 - 27 + dx + "px"; knob.style.top = r.height / 2 - 27 + dy + "px";
}
joyEl.addEventListener("pointerdown", (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
joyEl.addEventListener("pointermove", (e) => { if (e.pointerId === joy.id) joyMove(e); });
const joyFim = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.left = knob.style.top = "37px"; } };
joyEl.addEventListener("pointerup", joyFim); joyEl.addEventListener("pointercancel", joyFim);
knob.style.left = knob.style.top = "37px";
$("bA").addEventListener("pointerdown", () => atacar());
$("bH1").addEventListener("pointerdown", () => usarHabilidade("estocada"));
$("bH2").addEventListener("pointerdown", () => usarHabilidade("giro"));
$("bP").addEventListener("pointerdown", () => usarPocao());
$("bE").addEventListener("pointerdown", () => interagir());
$("bM").addEventListener("pointerdown", () => menu());
$("bS").addEventListener("pointerdown", () => { if (!parado) telaAtributos(); });
$("bI").addEventListener("pointerdown", () => { if (!parado) telaMochila(); });

function stats() { return derivados(D.P, D.itens, EST); }
function habsDaClasse() { return D.classes[EST.classe].habilidades.map((id) => D.hab[id]); }
function subiuNiveis(n) {
  if (!n) return;
  const antes = { ...EST.habilidades };
  aoSubir(D.P, EST, n, D.classes[EST.classe].recomendado, habsDaClasse());
  jogador.vida = stats().vidaMax;
  const nova = habsDaClasse().find((h) => EST.habilidades[h.id] && !antes[h.id]);
  msg(nova ? `Nível ${EST.nivel}! Nova habilidade: ${nova.nome}` : `Nível ${EST.nivel}!`, nova ? 3.5 : 2.4);
}

// usa uma habilidade (Golpe, Estocada, Giro...) se liberada, fora da cidade, sem outra ação em curso e sem recarga
function usarHabilidade(id) {
  const h = D.hab[id];
  if (!h || parado || jogador.morto || mapa.zonaSegura || jogador.golpe >= 0) return false;
  if (!EST.habilidades[id]) { msg(`${h.nome}: libera no nível ${h.nivel}`); return false; }
  if ((jogador.cds[id] || 0) > 0) return false;
  jogador.golpe = 0; jogador.hab = h;
  jogador.cds[id] = recargaHabilidade(h, D.porGrau, stats().recargaMult, EST.habilidades[id]);
  return true;
}
function atacar() { return usarHabilidade("golpe"); }
function usarPocao() {
  if (parado || jogador.morto) return;
  const sv = stats();
  if (EST.pocoes <= 0) return msg("Sem poções.");
  if (jogador.vida >= sv.vidaMax) return msg("Vida já está cheia.");
  EST.pocoes--; jogador.vida = Math.min(sv.vidaMax, jogador.vida + 60); msg("Poção usada."); salvar();
}

// ---------- missões / recompensas ----------
function registrarMorte(m) {
  const def = m.def, [a, b] = def.ouro;
  EST.ouro += a + Math.floor(Math.random() * (b - a + 1));
  subiuNiveis(ganharXp(D.P, EST, def.xp));
  for (const q of D.missoes) { const e = EST.missoes[q.id]; if (e && e.estado === "ativa" && q.alvo === def.id) { e.progresso = Math.min(q.quantidade, e.progresso + 1); if (e.progresso >= q.quantidade) { e.estado = "pronta"; msg(`Missão pronta: ${q.titulo}`); } } }
  m.mortoEm = performance.now();
  const reg = D.regioes.find((r) => r.cacada === mapa.id || r.cidade === mapa.id);
  const it = sortearDrop(D.itens, D.P, def, EST, reg ? reg.niveis[1] : EST.nivel, stats().atributos.sor, Math.random);
  if (it) chao.push({ it, x: m.x, y: m.y - 4, t: D.itens.drops.duracao_no_chao_s });
  salvar();
}

// ---------- interação ----------
function perto() {
  const alvos = mapa.npcs.map((n) => ({ tipo: n.tipo, x: n.x * TILE + 16, y: n.y * TILE + 16 }));
  if (mapa.portal) alvos.push({ tipo: "portal", x: mapa.portal.x * TILE + 16, y: mapa.portal.y * TILE + 16 });
  let melhor = null, md = 52;
  for (const a of alvos) { const d = Math.hypot(a.x - jogador.x, a.y - 12 - jogador.y); if (d < md) { md = d; melhor = a; } }
  return melhor;
}
function painel(html, acoes = []) {
  parado = true; $("caixa").innerHTML = html;
  for (const [t, fn, off] of acoes) { const b = document.createElement("button"); b.textContent = t; b.disabled = !!off; b.onclick = () => { fn(); }; $("caixa").appendChild(b); }
  const f = document.createElement("button"); f.textContent = "Fechar"; f.className = "fechar"; f.onclick = fechar; $("caixa").prepend(f);
  $("painel").classList.add("on");
}
function fechar() { parado = false; $("painel").classList.remove("on"); }
function interagir() {
  if (parado || jogador.morto) return;
  const a = perto(); if (!a) return;
  if (a.tipo === "mercador") return telaMercador();
  if (a.tipo === "ferreiro") return telaFerreiro();
  if (a.tipo === "quadro") return telaQuadro();
  if (a.tipo === "portal") {
    const reg = D.regioes.find((r) => r.cidade === mapa.id);
    if (!portalLiberado(EST, reg)) return painel(`<h3>Portal selado</h3><p>O portal antigo só reage a quem alcançar o nível ${reg.portal_proxima.nivel_minimo}. Você está no nível ${EST.nivel}.</p>`);
    const prox = D.regioes.find((r) => r.id === reg.portal_proxima.para);
    return painel(`<h3>Portal aberto</h3><p>O caminho para a ${prox.nome} se abre, mas essa região ainda não foi construída nesta versão.</p>`);
  }
}
function telaMercador() {
  const preco = D.itens.itens.find((i) => i.id === "pocao").preco;
  painel(`<h3>Mercador</h3><p>Ouro: ${EST.ouro} · Poções: ${EST.pocoes}${EST.mochila.length ? " · toque num item para vender" : ""}</p>`, [
    [`Comprar poção de vida (${preco} ouro)`, () => { if (EST.ouro >= preco) { EST.ouro -= preco; EST.pocoes++; salvar(); telaMercador(); } }, EST.ouro < preco],
    ...EST.mochila.map((it, i) => [`Vender ${nomeItem(D.itens, it)} (${precoVenda(D.itens, it)} ouro)`, () => { vender(D.itens, EST, i); salvar(); telaMercador(); }]),
  ]);
  colorirBotoes(EST.mochila, 1);
}
// cor da qualidade no texto dos botões de itens (a partir do botão de índice "desde")
function colorirBotoes(itens, desde) {
  const bs = [...$("caixa").querySelectorAll("button:not(.fechar)")];
  itens.forEach((it, i) => { if (bs[desde + i]) bs[desde + i].style.color = qualidade(D.itens, it.qual).cor; });
}

const NOME_ESPACO = { arma: "Arma", capacete: "Capacete", peitoral: "Peitoral", grevas: "Grevas" };
function descreverItem(it) {
  const v = valoresItem(D.itens, it), partes = [];
  if (v.dano) partes.push(`dano ${v.dano.toFixed(1)}`);
  if (v.vida) partes.push(`vida ${Math.round(v.vida)}`);
  for (const [a, n] of Object.entries(v.atributos)) partes.push(`+${n} ${NOME_ATR[a][0]}`);
  return partes.join(", ");
}
// diferença em relação ao que está vestido no mesmo espaço (dano e vida finais do personagem)
function comparar(i) {
  const it = EST.mochila[i], esp = baseItem(D.itens, it.base).espaco, antes = stats();
  const copia = { ...EST, equip: { ...EST.equip, [esp]: it } }, depois = derivados(D.P, D.itens, copia);
  const f = (n, s = "") => (n > 0 ? `<span style="color:#7fd27f">+${n}${s}</span>` : n < 0 ? `<span style="color:#ff7a7a">${n}${s}</span>` : "=");
  return `dano ${f(+(depois.dano - antes.dano).toFixed(1))}, vida ${f(depois.vidaMax - antes.vidaMax)}`;
}
function telaMochila(sel = -1) {
  const I = D.itens;
  const eq = I.espacos.map((e) => { const it = EST.equip[e]; return `<tr data-e="${e}" class="${sel === e ? "sel" : ""}"><td>${NOME_ESPACO[e]}</td><td>${it ? `<span style="color:${qualidade(I, it.qual).cor}">${nomeItem(I, it)}</span><br><small>${descreverItem(it)}</small>` : "<small>vazio</small>"}</td></tr>`; }).join("");
  const lista = EST.mochila.map((it, i) => `<button data-i="${i}" class="item${i === sel ? " sel" : ""}" style="color:${qualidade(I, it.qual).cor}">${nomeItem(I, it)}</button>`).join("") || "<p><small>Vazia. Monstros às vezes deixam itens no chão: passe por cima para pegar.</small></p>";
  let det = "<p><small>Toque num item para ver e equipar, ou numa peça vestida para tirar.</small></p>";
  const acoes = [];
  if (typeof sel === "string" && EST.equip[sel]) {
    const it = EST.equip[sel];
    det = `<p style="color:${qualidade(I, it.qual).cor}"><b>${nomeItem(I, it)}</b></p><p><small>${NOME_ESPACO[sel]} (vestido) · ${descreverItem(it)}</small></p>`;
    acoes.push(["Tirar", () => { if (comAjusteDeVida(() => desequipar(I, EST, sel))) msg(`Tirou: ${nomeItem(I, it)}`); else msg("Mochila cheia."); telaMochila(); }, EST.mochila.length >= I.mochila_max]);
  } else if (sel >= 0 && EST.mochila[sel]) {
    const it = EST.mochila[sel], imp = impedimento(I, EST, it);
    det = `<p style="color:${qualidade(I, it.qual).cor}"><b>${nomeItem(I, it)}</b></p><p><small>${NOME_ESPACO[baseItem(I, it.base).espaco]} · ${descreverItem(it)}</small></p><p><small>Se equipar: ${comparar(sel)}</small></p>${imp ? `<p><small>Não pode equipar: ${imp}</small></p>` : ""}`;
    acoes.push(["Equipar", () => { if (comAjusteDeVida(() => equipar(I, EST, sel))) msg(`Equipou: ${nomeItem(I, it)}`); telaMochila(); }, !!imp]);
    acoes.push(["Descartar", () => { if (confirm(`Descartar ${nomeItem(I, it)}?`)) { descartar(EST, sel); salvar(); telaMochila(); } }]);
  }
  painel(`<h3>Mochila <small>· ${EST.mochila.length}/${I.mochila_max}</small></h3><div class="duas"><div><table>${eq}</table></div><div class="dir"><div class="itens">${lista}</div>${det}</div></div>`, acoes);
  const dir = $("caixa").querySelector(".dir");
  for (const b of $("caixa").querySelectorAll("button[data-i]")) b.onclick = () => telaMochila(+b.dataset.i);
  for (const r of $("caixa").querySelectorAll("tr[data-e]")) r.onclick = () => telaMochila(r.dataset.e);
  dir.append(...[...$("caixa").children].filter((e) => e.tagName === "BUTTON" && !e.classList.contains("fechar")));
}
// provisório até o passo 4 (melhoria +1..+5 com chance e fragmentos): afiar sempre funciona, até +3
function telaFerreiro() {
  const arma = EST.equip.arma, custo = 60 * (arma.mais + 1), max = arma.mais >= 3;
  painel(`<h3>Ferreiro</h3><p>Espada longa +${arma.mais} (dano ${stats().dano.toFixed(1)}) · Ouro: ${EST.ouro}</p>`, [[max ? "Espada no máximo" : `Afiar a espada (+10% no dano da arma) por ${custo} ouro`, () => { if (EST.ouro >= custo) { EST.ouro -= custo; arma.mais++; salvar(); telaFerreiro(); } }, max || EST.ouro < custo]]);
}
function telaQuadro() {
  const lista = D.missoes.filter((q) => q.cidade === mapa.id);
  const acoes = lista.map((q) => {
    const e = EST.missoes[q.id];
    if (!e) return [`Aceitar: ${q.titulo} — ${q.texto}`, () => { EST.missoes[q.id] = { estado: "ativa", progresso: 0 }; salvar(); telaQuadro(); }];
    if (e.estado === "ativa") return [`${q.titulo}: ${e.progresso}/${q.quantidade}`, () => {}, true];
    if (e.estado === "pronta") return [`Entregar: ${q.titulo} (+${q.recompensa.xp} xp, +${q.recompensa.ouro} ouro)`, () => { e.estado = "entregue"; EST.ouro += q.recompensa.ouro; subiuNiveis(ganharXp(D.P, EST, q.recompensa.xp)); salvar(); telaQuadro(); }];
    return [`${q.titulo}: concluída`, () => {}, true];
  });
  painel("<h3>Quadro de missões</h3>", acoes);
}
const NOME_ATR = { for: ["Força", "dano"], vit: ["Vitalidade", "vida máxima"], agi: ["Agilidade", "recarga dos ataques e velocidade"], sor: ["Sorte", "chance de crítico e de itens melhores"] };
// mexer em atributos pode mudar a vida máxima: mantém a vida perdida, não a proporção
function comAjusteDeVida(fn) { const antes = stats().vidaMax, r = fn(); jogador.vida = Math.max(1, Math.min(stats().vidaMax, jogador.vida + stats().vidaMax - antes)); salvar(); return r; }
function telaHabilidades() {
  const P = D.P;
  const html = `<h3>Habilidades <small>· ${EST.pontosHab} ponto${EST.pontosHab === 1 ? "" : "s"} (1 a cada ${P.nivel_por_ponto_habilidade} níveis)</small></h3>` +
    habsDaClasse().map((h) => { const g = EST.habilidades[h.id];
      return `<div class="atr"><div><b>${h.nome}</b> ${g ? `grau ${g}/${P.grau_max_habilidade}` : `<small>libera no nível ${h.nivel}</small>`}<br><small>${h.descricao} Dano ${Math.round(h.mult * (1 + D.porGrau.mult * ((g || 1) - 1)) * 100)}%, recarga ${(h.recarga * (1 + D.porGrau.recarga * ((g || 1) - 1))).toFixed(1)} s</small></div>
        <button data-h="${h.id}" ${!g || g >= P.grau_max_habilidade || EST.pontosHab < 1 ? "disabled" : ""} aria-label="+1 grau ${h.nome}">+1</button></div>`; }).join("");
  painel(html, [["Voltar aos atributos", () => telaAtributos()]]);
  for (const b of $("caixa").querySelectorAll("button[data-h]")) b.onclick = () => { melhorarHabilidade(P, EST, b.dataset.h); salvar(); telaHabilidades(); };
}

function telaAtributos() {
  const P = D.P, sv = stats(), rec = D.classes[EST.classe].recomendado, custo = custoRedistribuir(P, EST), naCidade = mapa.zonaSegura;
  const sem = EST.pontosLivres <= 0;
  const linhas = P.atributos.map((a) => `<div class="atr"><div><b>${NOME_ATR[a][0]}</b> ${sv.atributos[a]}${sv.atributos[a] !== EST.atributos[a] ? ` <small>(${EST.atributos[a]} + itens)</small>` : ""}<br><small>${NOME_ATR[a][1]}</small></div><button data-a="${a}" ${sem ? "disabled" : ""} aria-label="+1 ${NOME_ATR[a][0]}">+1</button></div>`).join("");
  const html = `<h3>Atributos <small>· ${EST.pontosLivres} ponto${EST.pontosLivres === 1 ? "" : "s"} livre${EST.pontosLivres === 1 ? "" : "s"} (${P.pontos_por_nivel} por nível)</small></h3>
    <div class="duas"><div>${linhas}</div><div class="dir"><table><tr><td>Dano</td><td>${sv.dano.toFixed(1)}</td></tr><tr><td>Vida máxima</td><td>${sv.vidaMax}</td></tr>
    <tr><td>Recarga dos ataques</td><td>${Math.round(sv.recargaMult * 100)}%</td></tr><tr><td>Crítico</td><td>${(sv.critico * 100).toFixed(0)}% (×${sv.criticoMult})</td></tr></table></div></div>`;
  painel(html, [
    [`Habilidades${EST.pontosHab ? ` (+${EST.pontosHab} ponto${EST.pontosHab === 1 ? "" : "s"})` : ""}`, () => telaHabilidades()],
    [`Recomendado (${P.atributos.filter((a) => rec[a]).map((a) => `${rec[a]} ${NOME_ATR[a][0].slice(0, 3)}`).join(" : ")})`, () => { comAjusteDeVida(() => distribuirRecomendado(P, EST, rec)); telaAtributos(); }, sem],
    [`Distribuir sozinho: ${EST.autoDistribuir ? "ligado" : "desligado"}`, () => { EST.autoDistribuir = !EST.autoDistribuir; salvar(); telaAtributos(); }],
    [naCidade ? `Redistribuir pontos (${custo} ouro)` : "Redistribuir: só na cidade", () => { if (confirm(`Devolver todos os pontos distribuídos por ${custo} ouro?`)) { comAjusteDeVida(() => redistribuir(P, EST)); telaAtributos(); } }, !naCidade || EST.ouro < custo || gastos(P, EST) === 0],
  ]);
  for (const b of $("caixa").querySelectorAll("button[data-a]")) b.onclick = () => { comAjusteDeVida(() => distribuir(P, EST, b.dataset.a, 1)); telaAtributos(); };
  const acoes = [...$("caixa").children].filter((e) => e.tagName === "BUTTON" && !e.classList.contains("fechar"));
  $("caixa").querySelector(".duas > div").append(acoes.shift()); // Habilidades fica embaixo dos atributos
  $("caixa").querySelector(".dir").append(...acoes);
}

async function menu() {
  if (parado) return;
  painel(`<h3>Menu</h3><p>Nível ${EST.nivel} · ${EST.ouro} ouro</p>`, [
    ["Atributos", () => telaAtributos()],
    ["Créditos", async () => { let t = "Não foi possível carregar."; try { t = await texto("CREDITOS.md"); } catch { /* sem rede */ } painel(`<h3>Créditos</h3><pre></pre>`); $("caixa").querySelector("pre").textContent = t; }],
    ["Mostruário de arte", () => { location.href = "mostruario/"; }],
    ["Apagar progresso e recomeçar", () => { if (confirm("Apagar o progresso salvo?")) { apagar(localStorage); location.reload(); } }],
  ]);
}

// ---------- atualização ----------
function atualizar(dt) {
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $("msg").classList.remove("on"); }
  for (const k in jogador.cds) jogador.cds[k] = Math.max(0, jogador.cds[k] - dt);
  jogador.invul = Math.max(0, jogador.invul - dt);
  const sv = stats();
  if (jogador.veneno && !jogador.morto) { // veneno: dano contínuo, ignora invulnerabilidade, não mata sozinho abaixo de 1
    const v = jogador.veneno; v.t -= dt; jogador.vida = Math.max(1, jogador.vida - v.dps * dt);
    if (v.t <= 0 || mapa.zonaSegura) jogador.veneno = null;
  }
  if (!parado && !jogador.morto) {
    let ix = joy.x, iy = joy.y;
    if (teclas.has("a") || teclas.has("arrowleft")) ix -= 1; if (teclas.has("d") || teclas.has("arrowright")) ix += 1;
    if (teclas.has("w") || teclas.has("arrowup")) iy -= 1; if (teclas.has("s") || teclas.has("arrowdown")) iy += 1;
    const n = Math.hypot(ix, iy);
    if (n > 0.15 && jogador.golpe < 0) {
      const f = sv.velocidade * dt / Math.max(1, n); mover(jogador, ix * f, iy * f, mapa);
      jogador.dir = direcaoDe(ix, iy, jogador.dir); jogador.andando = true; jogador.tAnim += dt;
    } else jogador.andando = false;
    if (jogador.golpe >= 0) {
      const h = jogador.hab, antes = jogador.golpe; jogador.golpe += dt;
      if (antes < h.impacto && jogador.golpe >= h.impacto) {
        const r = atingir(jogador, monstros, h, danoHabilidade(h, D.porGrau, sv.dano, EST.habilidades[h.id] || 1), sv.critico, sv.criticoMult);
        for (const m of r.mortos) registrarMorte(m);
      }
      if (jogador.golpe >= h.duracao) jogador.golpe = -1;
    }
    const raio = D.P.monstros_ativos_raio;
    for (const m of monstros) {
      if (m.morto) { if (performance.now() - m.mortoEm > 1000 * (m.def.comportamento === "chefe" ? D.P.respawn_chefe_s : D.P.respawn_s)) Object.assign(m, criarMonstro(m.def, m.spawnX, m.spawnY)); continue; }
      m.ativo = Math.hypot(m.x - jogador.x, m.y - jogador.y) <= raio; // longe do jogador: parado, sem gastar processamento
      if (!m.ativo) continue;
      const r = atualizarMonstro(m, jogador, dt, mapa);
      if (r.dano && jogador.invul <= 0 && !jogador.morto) {
        jogador.vida -= r.dano; jogador.invul = 0.5;
        if (r.veneno) { jogador.veneno = { ...r.veneno, t: r.veneno.duracao }; msg("Envenenado!", 1.2); }
        if (jogador.vida <= 0) morrer();
      }
    }
    // itens no chão: somem com o tempo; pega ao passar por cima
    for (let i = chao.length - 1; i >= 0; i--) {
      const c = chao[i]; c.t -= dt;
      if (c.t <= 0) { chao.splice(i, 1); continue; }
      if (Math.hypot(c.x - jogador.x, c.y - jogador.y) < 22) {
        if (pegar(D.itens, EST, c.it)) { chao.splice(i, 1); msg(`Pegou: ${nomeItem(D.itens, c.it)}`, 2); $("msg").style.color = qualidade(D.itens, c.it.qual).cor; salvar(); }
        else if (performance.now() - avisoCheia > 3000) { avisoCheia = performance.now(); msg("Mochila cheia: venda ou descarte itens."); }
      }
    }
    // saídas do mapa
    for (const s of mapa.saidas) {
      const tx = Math.floor(jogador.x / TILE), ty = Math.floor((jogador.y - 4) / TILE);
      const sai = (s.lado === "leste" && tx >= mapa.w - 1) || (s.lado === "oeste" && tx <= 0) || (s.lado === "norte" && ty <= 0) || (s.lado === "sul" && ty >= mapa.h - 1);
      if (sai) { const de = mapa.id; entrar(s.destino, de); break; }
    }
    $("bE").style.display = perto() ? "flex" : "none";
  } else $("bE").style.display = "none";
  $("nv").textContent = `Nv ${EST.nivel}`;
  const bS = $("bS"), livres = EST.pontosLivres + EST.pontosHab;
  if (bS.dataset.n !== String(livres)) { bS.dataset.n = livres; bS.textContent = livres > 0 ? `+${livres}` : "Atrib."; bS.classList.toggle("tem", livres > 0); }
  for (const [bid, hid] of [["bH1", "estocada"], ["bH2", "giro"]]) {
    const b = $(bid), h = D.hab[hid], cd = jogador.cds[hid] || 0, livre = !!EST.habilidades[hid];
    const txt = !livre ? `Nv ${h.nivel}` : cd > 0 ? cd.toFixed(1) : h.nome;
    if (b.textContent !== txt) b.textContent = txt;
    b.classList.toggle("off", !livre || cd > 0 || mapa.zonaSegura);
  }
  $("hpb").classList.toggle("veneno", !!jogador.veneno);
  $("hpb").firstChild.style.width = Math.max(0, jogador.vida / sv.vidaMax * 100) + "%";
  $("xpb").firstChild.style.width = (EST.nivel >= D.P.nivel_max ? 100 : EST.xp / xpParaProximo(D.P, EST.nivel) * 100) + "%";
  $("info").textContent = `${EST.ouro} ouro · ${EST.pocoes} ${EST.pocoes === 1 ? "poção" : "poções"}`;
}
function morrer() {
  jogador.morto = true; jogador.veneno = null; jogador.golpe = -1; aoMorrer(EST); salvar();
  msg("Você caiu. Voltando à cidade…", 2.6);
  setTimeout(() => {
    const cidade = D.regioes.find((r) => r.id === "floresta").cidade;
    entrar(cidade, null); jogador.vida = stats().vidaMax; jogador.morto = false; jogador.invul = 1.5;
  }, 1800);
}

// ---------- desenho ----------
function quadroAnim(a, t, extra = 0) { return a.frames[Math.floor(t * 8 + extra) % a.frames.length]; }
function desenharMonstro(m, t) {
  const spec = MSTR[m.def.sprite];
  const atacando = (m.estado === "preparar" || m.estado === "executar") && spec.ataque;
  const a = atacando ? spec.ataque : spec.andar;
  const linha = a.rows[m.dir] ?? a.rows.down ?? Object.values(a.rows)[0];
  // no aviso, segura o primeiro quadro do ataque; ao executar, passa pelos demais
  const fr = !atacando ? quadroAnim(a, t, m.spawnX) : m.estado === "preparar" ? a.frames[0] : a.frames[Math.min(a.frames.length - 1, 1 + Math.floor(m.t * 12))];
  const s = m.def.escala, w = a.fw * s, h = a.fh * s;
  const dx = Math.round(m.x - w / 2 - cam.x), dy = Math.round(m.y - h + 6 * s - cam.y);
  if (m.flash > 0) ctx.globalAlpha = 0.55;
  ctx.drawImage(IMG[a.file], a.x0 + fr * a.fw, a.y0 + linha * a.fh, a.fw, a.fh, dx, dy, w, h);
  ctx.globalAlpha = 1;
  if (m.def.comportamento === "chefe") { // coroa desenhada em código
    ctx.fillStyle = "#ffcf33"; const cx = Math.round(m.x - cam.x), cy = dy + Math.round(h * 0.2);
    ctx.fillRect(cx - 7, cy + 4, 14, 4);
    for (const o of [-7, -1, 5]) ctx.fillRect(cx + o, cy, 3, 5);
  }
  if (m.vida < m.vidaMax) { const bx = Math.round(m.x - 14 - cam.x), by = dy - 4; ctx.fillStyle = "#000a"; ctx.fillRect(bx, by, 28, 4); ctx.fillStyle = "#e04a4a"; ctx.fillRect(bx + 1, by + 1, 26 * m.vida / m.vidaMax, 2); }
}
// aviso dos ataques dos monstros, desenhado no chão antes de tudo
function desenharAvisos() {
  for (const m of monstros) {
    if (m.morto || m.estado !== "preparar") continue;
    const a = m.atq, p = Math.min(1, m.t / a.aviso), x = m.x - cam.x, y = m.y - 6 - cam.y;
    ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * p; ctx.fillStyle = "#ff3030"; ctx.strokeStyle = "#ff5050";
    if (a.tipo === "investida") {
      const L = a.velocidade * a.duracao, w = a.raio * 1.2;
      ctx.translate(x, y); ctx.rotate(Math.atan2(m.alvo[1], m.alvo[0]));
      ctx.fillRect(0, -w / 2, L * p, w); ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.strokeRect(0, -w / 2, L, w);
    } else if (a.tipo === "area") {
      ctx.beginPath(); ctx.ellipse(x, y, a.raio * p, a.raio * p * 0.6, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(x, y, a.raio, a.raio * 0.6, 0, 0, 7); ctx.stroke();
    } else {
      ctx.globalAlpha = 1; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#ffdd33";
      ctx.fillText("!", x, y - a.raio - 22 * m.def.escala);
    }
    ctx.restore();
  }
}
const ORDEM_GIRO = ["down", "left", "up", "right"];
// camadas do personagem na ordem de itens.json ("corpo", "grevas", "peitoral", "cabeca", "capacete", "arma"):
// cada item vestido desenha a sua peça LPC; folhas "grandes" (192 px, como a espada longa ao golpear) ficam centradas
function camadas(anim) {
  const I = D.itens, corpo = I.corpo[EST.classe], out = [];
  for (const c of I.corpo.ordem_camadas) {
    if (c === "corpo") out.push({ img: IMG[`${corpo.base}/${anim}.png`], grande: false });
    else if (c === "cabeca") out.push({ img: IMG[`${corpo.cabeca}/${anim}.png`], grande: false });
    else { const it = EST.equip[c]; if (!it) continue; const v = baseItem(I, it.base).visual; out.push({ img: IMG[v[anim]], grande: (v.grande || []).includes(anim) }); }
  }
  return out;
}
function desenharCamadas(anim, col, linha, ox, oy) {
  for (const l of camadas(anim)) {
    if (!l.img) continue;
    if (l.grande) ctx.drawImage(l.img, col * 192, linha * 192, 192, 192, ox - 64, oy - 64, 192, 192);
    else ctx.drawImage(l.img, col * 64, linha * 64, 64, 64, ox, oy, 64, 64);
  }
}
function desenharJogador(t) {
  const g = jogador.golpe, h = jogador.hab;
  const dir = g >= 0 && h.animacao === "giro" ? ORDEM_GIRO[(ORDEM_GIRO.indexOf(jogador.dir) + Math.floor(g / h.duracao * 4)) % 4] : jogador.dir;
  const L = LINHA[dir], ox = Math.round(jogador.x - 32 - cam.x), oy = Math.round(jogador.y - 60 - cam.y);
  if (jogador.invul > 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.5;
  if (g >= 0 && h.animacao === "thrust") desenharCamadas("thrust", Math.min(7, Math.floor(g / h.duracao * 8)), L, ox, oy);
  else if (g >= 0) { // golpe e giro usam a animação de golpear; o giro troca de direção 4 vezes
    const passo = h.animacao === "giro" ? h.duracao / 4 : h.duracao;
    desenharCamadas("slash", Math.min(5, Math.floor((g % passo) / passo * 6)), L, ox, oy);
    if (h.animacao === "giro") { ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = "#dfefff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(jogador.x - cam.x, jogador.y - 14 - cam.y, h.raio, h.raio * 0.7, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  } else desenharCamadas("walk", jogador.andando ? 1 + Math.floor(jogador.tAnim * 10) % 8 : 0, L, ox, oy);
  ctx.globalAlpha = 1;
}
function etiqueta(txt, x, y) { ctx.font = "8px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#000b"; ctx.fillText(txt, x + 1, y + 1); ctx.fillStyle = "#fff"; ctx.fillText(txt, x, y); }
const NOMES = { mercador: "Mercador", ferreiro: "Ferreiro", quadro: "Missões", portal: "Portal" };
const cam = { x: 0, y: 0 };
function desenhar(t) {
  const W = mapa.w * TILE, H = mapa.h * TILE;
  cam.x = Math.round(Math.max(0, Math.min(W - VW, jogador.x - VW / 2))); cam.y = Math.round(Math.max(0, Math.min(H - VH, jogador.y - 30 - VH / 2)));
  if (W < VW) cam.x = Math.round((W - VW) / 2); if (H < VH) cam.y = Math.round((H - VH) / 2);
  ctx.fillStyle = "#10141a"; ctx.fillRect(0, 0, VW, VH);
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(mapa.w - 1, Math.floor((cam.x + VW) / TILE)), y1 = Math.min(mapa.h - 1, Math.floor((cam.y + VH) / TILE));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
    if (mapa.base === "terra") ctx.drawImage(IMG.dirt, 32, 160, 32, 32, px, py, 32, 32);
    else { const v = (tx * 7 + ty * 13) % 11; const c = v === 0 ? 1 : v === 1 ? 2 : 0; ctx.drawImage(IMG.forest_tiles, c * 32, 0, 32, 32, px, py, 32, 32); }
    if (tx === 0 || ty === 0 || tx === mapa.w - 1 || ty === mapa.h - 1) if (bloqueadoTile(mapa, tx, ty)) { ctx.fillStyle = "#0b2410"; ctx.fillRect(px, py, 32, 32); }
  }
  const fila = [];
  for (const o of mapa.objetos) fila.push({ y: (o.y + o.h) * TILE, f: () => {
    const px = o.x * TILE - cam.x, py = o.y * TILE - cam.y;
    if (o.tipo === "arvore") ctx.drawImage(IMG.forest_tiles, 0, (o.v ? 6 : 8) * 32, 64, 64, px, py, 64, 64);
    else if (o.tipo === "lagoa") ctx.drawImage(IMG.forest_tiles, 10 * 32, 8 * 32, 96, 96, px, py, 96, 96);
    else ctx.drawImage(IMG.house, 0, 0, 192, 160, px, py, 192, 160);
  } });
  for (const n of mapa.npcs) fila.push({ y: n.y * TILE + 28, f: () => {
    const px = n.x * TILE - cam.x, py = n.y * TILE - cam.y;
    if (n.tipo === "quadro") { ctx.drawImage(IMG.signs, 0, 0, 32, 32, px, py, 32, 32); etiqueta(NOMES[n.tipo], px + 16, py - 2); return; }
    const sp = n.tipo === "mercador" ? IMG.princess : IMG.soldier_altcolor;
    ctx.drawImage(sp, 0, 2 * 64, 64, 64, px - 16, py - 32, 64, 64); etiqueta(NOMES[n.tipo], px + 16, py - 28);
  } });
  if (mapa.portal) { const p = mapa.portal; fila.push({ y: p.y * TILE + 28, f: () => {
    const px = p.x * TILE + 16 - cam.x, py = p.y * TILE + 16 - cam.y, reg = D.regioes.find((r) => r.cidade === mapa.id), aberto = portalLiberado(EST, reg);
    ctx.fillStyle = aberto ? "#6fd0ff" : "#555a66"; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); ctx.beginPath(); ctx.ellipse(px, py, 14, 22, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = aberto ? "#bfeaff" : "#868c99"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py, 14, 22, 0, 0, 7); ctx.stroke();
    etiqueta(aberto ? "Portal" : `Portal (nv ${reg.portal_proxima.nivel_minimo})`, px, py - 28);
  } }); }
  desenharAvisos();
  for (const c of chao) { // brilho no chão com a cor da qualidade (desenhado em código: sem imagem nova)
    const cor = qualidade(D.itens, c.it.qual).cor, x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y), p = 0.6 + 0.4 * Math.sin(t * 5 + c.x);
    if (c.t < 10 && Math.floor(t * 6) % 2) continue; // pisca antes de sumir
    ctx.save(); ctx.globalAlpha = 0.35 * p; ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = cor; ctx.strokeStyle = "#000a"; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x, y + 1); ctx.lineTo(x - 5, y - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  for (const m of monstros) if (!m.morto && m.x > cam.x - 100 && m.x < cam.x + VW + 100 && m.y > cam.y - 60 && m.y < cam.y + VH + 140) fila.push({ y: m.y, f: () => desenharMonstro(m, t) });
  if (!jogador.morto) fila.push({ y: jogador.y, f: () => desenharJogador(t) });
  fila.sort((a, b) => a.y - b.y); for (const q of fila) q.f();
  for (const c of chao) if (c.it.qual !== "comum") etiqueta(nomeItem(D.itens, c.it), Math.round(c.x - cam.x), Math.round(c.y - cam.y) - 12); // nomes por cima de tudo
}

let antes = 0, acum = 0;
function quadro(agora) {
  const dt = Math.min(0.1, (agora - antes) / 1000 || 0); antes = agora; acum += dt;
  while (acum >= 1 / 60) { atualizar(1 / 60); acum -= 1 / 60; }
  desenhar(agora / 1000);
  requestAnimationFrame(quadro);
}
window.__valdor = { get chao() { return chao; }, get est() { return EST; }, get mapa() { return mapa; }, get jogador() { return jogador; }, get monstros() { return monstros; }, entrar, atacar, interagir, usarHabilidade,
  ganhar: (xp) => { subiuNiveis(ganharXp(D.P, EST, xp)); salvar(); } }; // ganchos para os testes de navegador
iniciar().catch((e) => { document.body.insertAdjacentHTML("beforeend", `<pre style="position:fixed;inset:0;background:#300;padding:12px;z-index:20;white-space:pre-wrap">Erro ao iniciar: ${String(e.message).replace(/</g, "&lt;")}</pre>`); console.error(e); });
