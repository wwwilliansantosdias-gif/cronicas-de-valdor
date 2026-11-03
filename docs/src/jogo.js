import { lerMapaTexto, gerarMapa, TILE, bloqueadoTile } from "./mapa.js";
import { novoEstado, ganharXp, portalLiberado, aoMorrer, xpParaProximo } from "./progresso.js";
import { carregar, guardar, apagar } from "./salvar.js";
import { criarMonstro, atualizarMonstro, atingir, danoHabilidade, recargaHabilidade, escalarArea, mover, direcaoDe, dentroDaArea, VET } from "./combate.js";
import { sortearDrop, nomeItem, precoVenda, pegar, equipar, desequipar, descartar, vender, impedimento, melhorar, proximaMelhoria, itemDoAlvo, sortearFragmentos } from "./itens.js";
import { derivados, estatisticas, valoresItem, baseItem, qualidade, conjuntosAtivos, aoSubir, distribuirRecomendado, distribuir, redistribuir, custoRedistribuir, gastos, desbloquearHabilidades, melhorarHabilidade } from "./personagem.js";

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

// flechas visuais (desenhadas em código): o dano vem da forma da habilidade no "impacto"; aqui é só o que se vê
const SOLTAR = 0.32, efeitos = [];
function soltarFlechas(h) {
  const [vx, vy] = VET[jogador.dir], ox = jogador.x, oy = jogador.y - 26, ang = Math.atan2(vy, vx);
  if (h.forma === "linha") {
    const alvo = monstros.filter((m) => !m.morto && dentroDaArea(jogador, m, h)).sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy))[0];
    const d = alvo ? Math.hypot(alvo.x - ox, alvo.y - 12 - oy) : h.alcance;
    efeitos.push({ tipo: "voo", x0: ox, y0: oy, ang, d, t: 0, dur: d / 900 });
  } else if (h.forma === "leque") {
    for (let k = 0; k < h.flechas; k++) { const a = ang + ((k / (h.flechas - 1)) - 0.5) * h.angulo * Math.PI / 180; efeitos.push({ tipo: "voo", x0: ox, y0: oy, ang: a, d: h.alcance, t: 0, dur: h.alcance / 900 }); }
  } else if (h.forma === "circulo") {
    const cx = jogador.x + vx * h.distancia, cy = jogador.y - 14 + vy * h.distancia, cai = h.impacto - SOLTAR;
    efeitos.push({ tipo: "anel", x: cx, y: cy, r: h.raio, t: 0, dur: cai });
    for (let k = 0; k < 10; k++) { const a = Math.random() * 7, r = Math.sqrt(Math.random()) * h.raio; efeitos.push({ tipo: "queda", x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, t: -Math.random() * 0.12, dur: cai }); }
  }
}
function desenharEfeitos(dt) {
  for (let i = efeitos.length - 1; i >= 0; i--) {
    const e = efeitos[i]; e.t += dt;
    if (e.t >= e.dur + 0.05) { efeitos.splice(i, 1); continue; }
    if (e.t < 0) continue;
    const p = Math.min(1, e.t / e.dur);
    ctx.save(); ctx.strokeStyle = "#7a5432"; ctx.fillStyle = "#f2f2f8"; ctx.lineWidth = 2;
    if (e.tipo === "voo") { // 2,5D: a flecha sobe e desce em arco; a sombra corre reta no chão
      const gx = e.x0 + Math.cos(e.ang) * e.d * p - cam.x, gy = e.y0 + 22 + Math.sin(e.ang) * e.d * p - cam.y;
      const alt = Math.sin(Math.PI * p) * Math.min(26, e.d * 0.12) + 22, x = gx, y = gy - alt;
      const inc = Math.cos(Math.PI * p) * 0.6, dx = Math.cos(e.ang), dy = Math.sin(e.ang) - inc * Math.abs(Math.cos(e.ang));
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#000"; ctx.fillRect(Math.round(gx - 4), Math.round(gy), 8, 2); ctx.restore();
      ctx.beginPath(); ctx.moveTo(x - dx * 16, y - dy * 16); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
    } else if (e.tipo === "queda") {
      const x = e.x - cam.x, y = e.y - cam.y - (1 - p) * 90;
      ctx.save(); ctx.globalAlpha = 0.15 + 0.3 * p; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(e.x - cam.x, e.y - cam.y, 1 + 3 * p, 1 + p, 0, 0, 7); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x, y); ctx.stroke(); ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
    } else if (e.tipo === "anel") {
      ctx.globalAlpha = 0.25 + 0.35 * p; ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x - cam.x, e.y - cam.y, e.r, e.r * 0.6, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}
const flutuantes = [];
let ultimoPoder = 0;
function flutuar(txt, x, y, cor) { flutuantes.push({ txt, x, y, cor, t: 1.2 }); }
function msg(t, s = 2.4) { $("msg").style.color = ""; $("msg").textContent = t; $("msg").classList.add("on"); msgT = s; }
function salvar() { guardar(localStorage, EST); }

async function iniciar() {
  const [regioes, mons, itens, missoes, mostr, prog, classes, habs] = await Promise.all(["dados/regioes.json", "dados/monstros.json", "dados/itens.json", "dados/missoes.json", "mostruario/mostruario.json", "dados/progressao.json", "dados/classes.json", "dados/habilidades.json"].map(json));
  D = { regioes: regioes.regioes, mapasTxt: regioes.mapas, monstros: Object.fromEntries(mons.monstros.map((m) => [m.id, m])), itens, missoes: missoes.missoes,
    P: prog, classes: Object.fromEntries(classes.classes.map((c) => [c.id, c])), hab: Object.fromEntries(habs.habilidades.map((h) => [h.id, h])), porGrau: habs.por_grau };
  for (const m of mostr.monstros) MSTR[m.id] = m;
  const arq = ["forest_tiles", "dirt", "signs", "house", "soldier", "soldier_altcolor", "princess", ...["casa_tijolo", "casa_pedra", "fonte", "barraca", "quadro", "forja", "poco"].map((c) => "cidade/" + c)];
  IMG = Object.fromEntries(await Promise.all(arq.map(async (n) => [n, await imagem(`assets/${n}.png`)])));
  // peças do personagem: corpo, cabeça e o visual de cada item (camadas empilhadas na hora)
  const pecas = new Set();
  const caminhos = (v) => (typeof v === "string" ? [v] : v && v.arquivo ? [v.arquivo] : v && typeof v === "object" ? Object.entries(v).filter(([k]) => k !== "grande" && k !== "peca_lpc").flatMap(([, x]) => caminhos(x)) : []);
  for (const c of Object.values(itens.corpo)) {
    for (const a of c.animacoes) { pecas.add(`${c.base}/${a}.png`); pecas.add(`${c.cabeca}/${a}.png`); }
    for (const e of Object.values(c.extras || {})) caminhos(e).forEach((f) => pecas.add(f));
  }
  for (const it of itens.itens) caminhos(it.visual).forEach((f) => pecas.add(f));
  await Promise.all([...pecas].map(async (f) => { IMG[f] = await imagem("assets/pecas/" + f); }));
  const usados = new Set();
  for (const id in D.monstros) { const s = MSTR[D.monstros[id].sprite]; for (const k of ["andar", "ataque"]) if (s[k]) usados.add(s[k].file); }
  for (const f of usados) IMG[f] = await imagem("mostruario/" + f);
  for (const [id, f] of Object.entries(D.mapasTxt)) MAPAS[id] = gerarMapa(lerMapaTexto(await texto(f)));
  EST = carregar(D.P, D.itens, localStorage, Object.keys(MAPAS));
  if (!EST) { const c = await escolherClasse(); EST = novoEstado(D.P, D.itens, c, D.classes[c].habilidades[0]); }
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
addEventListener("keydown", (e) => { const k = e.key.toLowerCase(); teclas.add(k); if (k === " ") atacar(); if (k === "1") usarHabilidade(habN(1)); if (k === "2") usarHabilidade(habN(2)); if (k === "e") interagir(); if (k === "q") usarPocao(); });
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
$("bH1").addEventListener("pointerdown", () => usarHabilidade(habN(1)));
$("bH2").addEventListener("pointerdown", () => usarHabilidade(habN(2)));
// n-ésima habilidade da classe (0 = ataque básico; 1 e 2 = botões de habilidade)
function habN(n) { return D.classes[EST.classe].habilidades[n]; }
// personagem novo: escolha da classe
function escolherClasse() {
  return new Promise((ok) => {
    const cs = Object.values(D.classes).filter((c) => c.implementada);
    const desc = { guerreiro: "Corpo a corpo: Golpe, Estocada e Giro. Aguenta mais pancada.", arqueiro: "À distância: Disparo, Dispersão (acerta vários de uma vez) e Chuva de flechas." };
    painel(`<h3>Novo personagem</h3><p>Escolha a classe:</p>${cs.map((c) => `<p><b>${c.nome}</b>: <small>${desc[c.id] || ""}</small></p>`).join("")}`, cs.map((c) => [c.nome, () => { fechar(); ok(c.id); }]));
    $("caixa").querySelector(".fechar")?.remove();
  });
}
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
  const ganhos = `+${n * D.P.pontos_por_nivel} pontos${EST.autoDistribuir ? " (distribuídos)" : ""}`;
  msg(nova ? `Nível ${EST.nivel}! Nova habilidade: ${nova.nome} · ${ganhos}` : `Nível ${EST.nivel}! ${ganhos}`, nova ? 3.5 : 2.6);
}

// usa uma habilidade (Golpe, Estocada, Giro...) se liberada, fora da cidade, sem outra ação em curso e sem recarga
function usarHabilidade(id) {
  const h = D.hab[id];
  if (!h || parado || jogador.morto || mapa.zonaSegura || jogador.golpe >= 0) return false;
  if (!EST.habilidades[id]) { msg(`${h.nome}: libera no nível ${h.nivel}`); return false; }
  if ((jogador.cds[id] || 0) > 0) return false;
  jogador.golpe = 0; jogador.hab = escalarArea(h, D.porGrau, EST.habilidades[id]); // área cresce com o grau
  jogador.cds[id] = recargaHabilidade(h, D.porGrau, stats().recargaMult, EST.habilidades[id]);
  return true;
}
function atacar() { return usarHabilidade(habN(0)); }
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
  const frag = sortearFragmentos(D.itens, def, Math.random);
  if (frag) { EST.fragmentos += frag; flutuar(`+${frag} fragmento${frag > 1 ? "s" : ""}`, m.x, m.y - 40, "#c9d4ff"); }
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

const NOME_ESPACO = { arma: "Arma", escudo: "Escudo", capacete: "Capacete", ombros: "Ombros", peitoral: "Peitoral", bracos: "Braços", capa: "Capa", grevas: "Grevas", botas: "Botas" };
function descreverConjunto(it) {
  const c = (D.itens.conjuntos || []).find((x) => x.pecas.includes(it.base));
  if (!c) return "";
  const n = conjuntosAtivos(D.itens, EST.equip).find((x) => x.conjunto.id === c.id)?.n || 0;
  const txt = Object.entries(c.bonus).map(([k, b]) => { const p = [...Object.entries(b.atributos || {}).map(([a, v]) => `+${v} ${NOME_ATR[a][0]}`), b.vida ? `+${b.vida} vida` : "", b.dano ? `+${b.dano} dano` : "", b.aura ? "aura" : ""].filter(Boolean).join(", ");
    return `<span class="${n >= +k ? "up" : ""}">${k}: ${p}</span>`; }).join(" · ");
  return `<br><small style="color:${c.cor}">Conjunto ${c.nome} (${n}/${c.pecas.length} vestidas)</small> <small>${txt}</small>`;
}
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
function telaFerreiro(alvo = null, resultado = "") {
  const I = D.itens;
  const alvos = [...I.espacos.filter((e) => EST.equip[e]).map((e) => ({ espaco: e })), ...EST.mochila.map((_, i) => ({ i }))];
  const rotulo = (a) => `${a.espaco ? NOME_ESPACO[a.espaco] + ": " : ""}${nomeItem(I, itemDoAlvo(EST, a))}`;
  let det = `<p><small>Escolha um item. Cada melhoria dá +${Math.round(I.melhoria.bonus_por_nivel * 100)}% nos valores do item. Se falhar, gasta o custo e o item continua igual.</small></p>`;
  const acoes = alvos.map((a) => [rotulo(a), () => telaFerreiro(a)]);
  if (alvo && itemDoAlvo(EST, alvo)) {
    const it = itemDoAlvo(EST, alvo), p = proximaMelhoria(I, it);
    det = `<p style="color:${qualidade(I, it.qual).cor}"><b>${nomeItem(I, it)}</b></p><p><small>${descreverItem(it)}</small></p>` +
      (p ? `<p>+${it.mais} → <b>+${p.para}</b> · chance ${Math.round(p.chance * 100)}%<br><small>${p.ouro} ouro${p.fragmentos ? ` e ${p.fragmentos} fragmento${p.fragmentos > 1 ? "s" : ""}` : ""}</small></p>` : "<p>Já está no máximo.</p>") + resultado;
    if (p) acoes.unshift([`Melhorar para +${p.para}`, () => {
      const r = comAjusteDeVida(() => melhorar(I, EST, alvo));
      telaFerreiro(alvo, !r.feito ? `<p style="color:#ff7a7a">${r.motivo}</p>` : r.sucesso ? `<p style="color:#7fd27f"><b>Sucesso! Agora +${r.mais}.</b></p>` : `<p style="color:#ff7a7a"><b>Falhou.</b> O item continua +${r.mais}.</p>`);
    }, EST.ouro < p.ouro || EST.fragmentos < p.fragmentos]);
  }
  painel(`<h3>Ferreiro <small>· ${EST.ouro} ouro · ${EST.fragmentos} fragmentos</small></h3><div class="duas"><div class="itens lista"></div><div class="dir">${det}</div></div>`, acoes);
  const bs = [...$("caixa").children].filter((e) => e.tagName === "BUTTON" && !e.classList.contains("fechar"));
  const melhorarBtn = alvo && bs[0] && bs[0].textContent.startsWith("Melhorar") ? bs.shift() : null;
  $("caixa").querySelector(".lista").append(...bs);
  bs.forEach((b, k) => { const it = itemDoAlvo(EST, alvos[k]); b.style.color = qualidade(I, it.qual).cor; b.insertAdjacentHTML("afterbegin", imgIcone(it)); if (alvo && JSON.stringify(alvos[k]) === JSON.stringify(alvo)) b.classList.add("sel"); });
  if (melhorarBtn) $("caixa").querySelector(".dir").append(melhorarBtn);
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
// ---------- tela de Personagem: boneco, números e abas (Equipamento, Atributos, Habilidades) ----------
const ABA = { aba: "equip", sel: -1, dir: "down" };
function telaMochila(sel = -1) { telaPersonagem("equip", sel); }
function telaAtributos() { telaPersonagem("atrib"); }
function telaHabilidades() { telaPersonagem("hab"); }
function numeros(est) { const sv = derivados(D.P, D.itens, est); return { sv, ...estatisticas(D.P, sv, D.hab[habN(0)]) }; }
function telaPersonagem(aba = ABA.aba, sel = -1) {
  ABA.aba = aba; ABA.sel = sel;
  const I = D.itens, P = D.P, agora = numeros(EST);
  if (!$("painel").classList.contains("on") || !$("previa")) ABA.poderAoAbrir = agora.poder; // ganho mostrado no título
  const ganho = agora.poder - ABA.poderAoAbrir;
  // provar: item escolhido na mochila aparece vestido no boneco e os números mostram a diferença
  const provando = aba === "equip" && typeof sel === "number" && EST.mochila[sel] ? EST.mochila[sel] : null;
  const equipPrevia = provando ? { ...EST.equip, [baseItem(I, provando.base).espaco]: provando } : EST.equip;
  const depois = provando ? numeros({ ...EST, equip: equipPrevia }) : null;
  const dif = (a, b, casas = 0, suf = "") => { if (!depois) return ""; const d = +(b - a).toFixed(casas); return d > 0 ? ` <span class="up">+${d}${suf}</span>` : d < 0 ? ` <span class="down">${d}${suf}</span>` : ""; };
  const sv = agora.sv, dv = depois && depois.sv;
  const linhasNum = [
    ["Poder", agora.poder, dif(agora.poder, depois?.poder)],
    ["Dano", sv.dano.toFixed(1), dif(sv.dano, dv?.dano, 1)],
    ["Ataques/s", agora.ataquesPorSeg.toFixed(2), dif(agora.ataquesPorSeg, depois?.ataquesPorSeg, 2)],
    ["Dano/s", agora.dps.toFixed(1), dif(agora.dps, depois?.dps, 1)],
    ["Vida", sv.vidaMax, dif(sv.vidaMax, dv?.vidaMax)],
    ["Velocidade", Math.round(sv.velocidade), dif(sv.velocidade, dv?.velocidade)],
    ["Crítico", `${Math.round(sv.critico * 100)}%`, dif(sv.critico * 100, dv?.critico * 100, 0, "%")],
  ].map(([k, v, d]) => `<tr><td>${k}</td><td>${v}${d}</td></tr>`).join("");
  const semEscudo = EST.classe !== "guerreiro";
  const slot = (e) => { const it = equipPrevia[e]; if (e === "escudo" && semEscudo) return `<span class="slot s-escudo vazio" title="o Arqueiro usa as duas mãos"><small>—</small></span>`;
    return `<button class="slot s-${e}${sel === e ? " sel" : ""}${it && it === provando ? " prova" : ""}" data-e="${e}" aria-label="${NOME_ESPACO[e]}" style="border-color:${it ? qualidade(I, it.qual).cor : "#fff3"}">${it ? imgIcone(it) + (it.mais ? `<i>+${it.mais}</i>` : "") : `<small>${NOME_ESPACO[e]}</small>`}</button>`; };
  const boneco = `<div class="boneco">${["capacete", "ombros", "bracos", "arma", "peitoral", "capa", "grevas", "botas", "escudo"].map(slot).join("")}<canvas id="previa" width="64" height="64" aria-label="personagem"></canvas></div>`;
  const resumoConjuntos = (eq) => conjuntosAtivos(I, eq).map((c) => `<span style="color:${c.conjunto.cor}">Conjunto ${c.conjunto.nome} ${c.n}/${c.total}</span>`).join(" · ");
  const abas = [["equip", "Equipamento"], ["atrib", `Atributos${EST.pontosLivres ? ` (+${EST.pontosLivres})` : ""}`], ["hab", `Habilidades${EST.pontosHab ? ` (+${EST.pontosHab})` : ""}`]]
    .map(([id, t]) => `<button class="aba${aba === id ? " on" : ""}" data-aba="${id}">${t}</button>`).join("");
  let corpo = "", acoes = [];
  if (aba === "equip") {
    const grade = Array.from({ length: I.mochila_max }, (_, i) => { const it = EST.mochila[i];
      return it ? `<button class="slot${i === sel ? " sel" : ""}" data-i="${i}" aria-label="${nomeItem(I, it)}" style="border-color:${qualidade(I, it.qual).cor}">${imgIcone(it)}${it.mais ? `<i>+${it.mais}</i>` : ""}</button>` : `<span class="slot vazio"></span>`; }).join("");
    const rc = resumoConjuntos(EST.equip);
    let det = `<small>Mochila ${EST.mochila.length}/${I.mochila_max}. Toque num item para provar no boneco.${rc ? "<br>" + rc : ""}</small>`;
    if (typeof sel === "string" && EST.equip[sel]) {
      const it = EST.equip[sel];
      det = `<b style="color:${qualidade(I, it.qual).cor}">${nomeItem(I, it)}</b> <small>· ${NOME_ESPACO[sel]} (vestido) · ${descreverItem(it)}</small>${descreverConjunto(it)}`;
      acoes.push(["Tirar", () => { if (comAjusteDeVida(() => desequipar(I, EST, sel))) msg(`Tirou: ${nomeItem(I, it)}`); else msg("Mochila cheia."); telaPersonagem("equip"); }, EST.mochila.length >= I.mochila_max]);
    } else if (provando) {
      const imp = impedimento(I, EST, provando);
      det = `<b style="color:${qualidade(I, provando.qual).cor}">${nomeItem(I, provando)}</b> <small>· ${NOME_ESPACO[baseItem(I, provando.base).espaco]} · nível ${baseItem(I, provando.base).nivel} · ${descreverItem(provando)}</small><br><small>Se equipar: ${comparar(sel)}${imp ? ` · <b>não pode: ${imp}</b>` : ""}</small>${descreverConjunto(provando)}`;
      acoes.push(["Equipar", () => { const p0 = numeros(EST).poder; if (comAjusteDeVida(() => equipar(I, EST, sel))) msg(`Equipou: ${nomeItem(I, provando)} · Poder ${p0} → ${numeros(EST).poder}`); telaPersonagem("equip"); }, !!imp]);
      acoes.push(["Descartar", () => { if (confirm(`Descartar ${nomeItem(I, provando)}?`)) { descartar(EST, sel); salvar(); telaPersonagem("equip"); } }]);
    }
    corpo = `<div class="mgrade">${grade}</div><div class="det">${det}</div>`;
  } else if (aba === "atrib") {
    const rec = D.classes[EST.classe].recomendado, custo = custoRedistribuir(P, EST), naCidade = mapa.zonaSegura, sem = EST.pontosLivres <= 0;
    corpo = `<p class="det"><small>${EST.pontosLivres} ponto${EST.pontosLivres === 1 ? "" : "s"} livre${EST.pontosLivres === 1 ? "" : "s"} · ${P.pontos_por_nivel} por nível</small></p>` +
      P.atributos.map((a) => `<div class="atr"><div><b>${NOME_ATR[a][0]}</b> ${sv.atributos[a]}${sv.atributos[a] !== EST.atributos[a] ? ` <small>(${EST.atributos[a]} + itens)</small>` : ""}<small> · ${NOME_ATR[a][1]}</small></div><button data-a="${a}" ${sem ? "disabled" : ""} aria-label="+1 ${NOME_ATR[a][0]}">+1</button></div>`).join("");
    acoes = [
      [`Recomendado (${P.atributos.filter((a) => rec[a]).map((a) => `${rec[a]} ${NOME_ATR[a][0].slice(0, 3)}`).join(" : ")})`, () => { comAjusteDeVida(() => distribuirRecomendado(P, EST, rec)); telaPersonagem("atrib"); }, sem],
      [`Distribuir sozinho: ${EST.autoDistribuir ? "ligado" : "desligado"}`, () => { EST.autoDistribuir = !EST.autoDistribuir; salvar(); telaPersonagem("atrib"); }],
      [naCidade ? `Redistribuir (${custo} ouro)` : "Redistribuir: só na cidade", () => { if (confirm(`Devolver todos os pontos distribuídos por ${custo} ouro?`)) { comAjusteDeVida(() => redistribuir(P, EST)); telaPersonagem("atrib"); } }, !naCidade || EST.ouro < custo || gastos(P, EST) === 0],
    ];
  } else {
    corpo = `<p class="det"><small>${EST.pontosHab} ponto${EST.pontosHab === 1 ? "" : "s"} de habilidade · 1 a cada ${P.nivel_por_ponto_habilidade} níveis · cada grau: +${Math.round(D.porGrau.mult * 100)}% dano, ${Math.round(D.porGrau.recarga * 100)}% recarga, +${Math.round(D.porGrau.area * 100)}% área</small></p>` +
      habsDaClasse().map((h) => { const g = EST.habilidades[h.id] || 0, a = escalarArea(h, D.porGrau, g || 1), b = escalarArea(h, D.porGrau, Math.min(P.grau_max_habilidade, (g || 1) + 1));
        const area = h.forma === "leque" ? `${Math.round(a.alcance)} px, ${Math.round(a.angulo)}°` : h.forma === "linha" ? `${Math.round(a.alcance)} px` : `raio ${Math.round(a.raio)} px`;
        const prox = g && g < P.grau_max_habilidade ? ` → ${h.forma === "leque" ? `${Math.round(b.alcance)} px, ${Math.round(b.angulo)}°` : h.forma === "linha" ? `${Math.round(b.alcance)} px` : `raio ${Math.round(b.raio)} px`}` : "";
        return `<div class="atr"><div><b>${h.nome}</b> ${g ? `grau ${g}/${P.grau_max_habilidade}` : `<small>libera no nível ${h.nivel}</small>`}<br><small>${Math.round(h.mult * (1 + D.porGrau.mult * ((g || 1) - 1)) * 100)}% dano · ${(h.recarga * (1 + D.porGrau.recarga * ((g || 1) - 1))).toFixed(1)} s · área ${area}${prox}</small></div>
          <button data-h="${h.id}" ${!g || g >= P.grau_max_habilidade || EST.pontosHab < 1 ? "disabled" : ""} aria-label="+1 grau ${h.nome}">+1</button></div>`; }).join("");
  }
  painel(`<h3>Personagem <small>· ${D.classes[EST.classe].nome} nível ${EST.nivel} · Poder <b>${agora.poder}</b>${depois ? dif(agora.poder, depois.poder) : ganho > 0 ? ` <span class="up">(+${ganho} agora)</span>` : ""}</small></h3>
    <div class="pers"><div class="esq">${boneco}<table class="num">${linhasNum}</table></div><div class="dirp"><div class="abas">${abas}</div><div class="conteudo">${corpo}</div></div></div>`, acoes);
  const cx = $("caixa");
  cx.querySelector(".conteudo").append(...[...cx.children].filter((e) => e.tagName === "BUTTON" && !e.classList.contains("fechar")));
  for (const b of cx.querySelectorAll("button[data-aba]")) b.onclick = () => telaPersonagem(b.dataset.aba);
  for (const b of cx.querySelectorAll("button[data-i]")) b.onclick = () => telaPersonagem("equip", +b.dataset.i);
  for (const b of cx.querySelectorAll("button[data-e]")) b.onclick = () => telaPersonagem("equip", EST.equip[b.dataset.e] ? b.dataset.e : -1);
  for (const b of cx.querySelectorAll("button[data-a]")) b.onclick = () => { comAjusteDeVida(() => distribuir(P, EST, b.dataset.a, 1)); telaPersonagem("atrib"); };
  for (const b of cx.querySelectorAll("button[data-h]")) b.onclick = () => { melhorarHabilidade(P, EST, b.dataset.h); salvar(); telaPersonagem("hab"); };
  const cv = $("previa"); cv.onclick = () => { ABA.dir = ORDEM_GIRO[(ORDEM_GIRO.indexOf(ABA.dir) + 1) % 4]; };
  animarPrevia(cv, equipPrevia);
}
// boneco da tela de Personagem: anda no lugar, com o equipamento (ou a prova) em camadas
function animarPrevia(cv, equip) {
  const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  const passo = (t) => {
    if (!document.body.contains(cv)) return;
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = "#0004"; x.beginPath(); x.ellipse(32, 60, 12, 4, 0, 0, 7); x.fill();
    desenharCamadas("walk", 1 + Math.floor(t / 100) % 8, LINHA[ABA.dir], 0, 0, x, equip);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

async function menu() {
  if (parado) return;
  painel(`<h3>Menu</h3><p>Nível ${EST.nivel} · ${EST.ouro} ouro</p>`, [
    ["Atributos", () => telaAtributos()],
    ["Créditos", async () => { let t = "Não foi possível carregar."; try { t = await texto("CREDITOS.md"); } catch { /* sem rede */ } painel(`<h3>Créditos</h3><pre></pre>`); $("caixa").querySelector("pre").textContent = t; }],
    ["Mostruário de arte", () => { location.href = "mostruario/"; }],
    ["Novo personagem (apaga o progresso)", () => { if (confirm("Apagar o progresso salvo e criar outro personagem?")) { apagar(localStorage); location.reload(); } }],
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
      if (h.animacao === "shoot" && antes < SOLTAR && jogador.golpe >= SOLTAR) soltarFlechas(h);
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
    const pp = perto();
    $("bE").style.display = pp ? "flex" : "none";
    if (pp) { const r = { mercador: "Loja", ferreiro: "Forja", quadro: "Missões", portal: "Portal" }[pp.tipo] || "Falar"; if ($("bE").textContent !== r) $("bE").textContent = r; }
  } else $("bE").style.display = "none";
  const pd = numeros(EST).poder;
  if (ultimoPoder && pd > ultimoPoder && !parado) flutuar(`+${pd - ultimoPoder} Poder`, jogador.x, jogador.y - 70, "#7fd27f");
  const rot = `Nv ${EST.nivel} · Poder ${pd}`;
  ultimoPoder = pd; if ($("nv").textContent !== rot) $("nv").textContent = rot;
  const bS = $("bS"), livres = EST.pontosLivres + EST.pontosHab;
  if (bS.dataset.n !== String(livres)) { bS.dataset.n = livres; bS.textContent = livres > 0 ? `+${livres}` : "Atrib."; bS.classList.toggle("tem", livres > 0); }
  for (const [bid, hid] of [["bH1", habN(1)], ["bH2", habN(2)]]) {
    const b = $(bid), h = D.hab[hid], cd = jogador.cds[hid] || 0, livre = !!EST.habilidades[hid];
    const txt = !livre ? `Nv ${h.nivel}` : cd > 0 ? cd.toFixed(1) : h.nome;
    if (b.textContent !== txt) b.textContent = txt;
    b.classList.toggle("off", !livre || cd > 0 || mapa.zonaSegura);
  }
  $("hpb").classList.toggle("veneno", !!jogador.veneno);
  $("hpb").firstChild.style.width = Math.max(0, jogador.vida / sv.vidaMax * 100) + "%";
  $("xpb").firstChild.style.width = (EST.nivel >= D.P.nivel_max ? 100 : EST.xp / xpParaProximo(D.P, EST.nivel) * 100) + "%";
  $("info").textContent = `${EST.ouro} ouro · ${EST.pocoes} ${EST.pocoes === 1 ? "poção" : "poções"} · ${EST.fragmentos} frag.`;
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
  ctx.fillStyle = "#0005"; ctx.beginPath(); ctx.ellipse(Math.round(m.x - cam.x), Math.round(m.y - 1 - cam.y), 11 * s, 4 * s, 0, 0, 7); ctx.fill(); // sombra
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
// entrada de "visual": caminho (string) ou { arquivo, coluna } (quadro fixo, ex.: arco parado ao andar)
const arqDe = (v) => (typeof v === "string" ? v : v && v.arquivo);
// peça tingida com a cor da qualidade (em código, a partir da própria peça LPC; resultado guardado em cache)
const tingidas = {};
// peça com a cor da qualidade e do material, feita em código a partir da própria peça LPC (resultado em cache):
// pixels de metal (pouca saturação) seguem a rampa do material (qualidade Refinado/Raro/Lendário, senão o material
// do item, ex.: bronze, Cinzaltar); couro e tecido recebem só uma tinta leve da cor da qualidade
function pecaTingida(entrada, qual, materialItem = null) {
  const caminho = arqDe(entrada);
  const q = qualidade(D.itens, qual), img = IMG[caminho], mat = q.material || materialItem;
  if (!img || (!q.tinta && !mat)) return img;
  const k = caminho + "|" + qual + "|" + (mat || "");
  if (!tingidas[k]) {
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const dados = x.getImageData(0, 0, c.width, c.height), px = dados.data, rampa = mat && D.itens.materiais[mat];
    const [tr, tg, tb] = [1, 3, 5].map((i) => parseInt(q.cor.slice(i, i + 2), 16));
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
      const sat = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 510 - mx - mn : mx + mn);
      if (rampa && sat < 0.18) { const cor = rampa[Math.min(rampa.length - 1, Math.floor(l * rampa.length))]; px[i] = cor[0]; px[i + 1] = cor[1]; px[i + 2] = cor[2]; }
      else if (q.tinta) { px[i] += (tr - r) * q.tinta; px[i + 1] += (tg - g) * q.tinta; px[i + 2] += (tb - b) * q.tinta; }
    }
    x.putImageData(dados, 0, 0);
    tingidas[k] = c;
  }
  return tingidas[k];
}
// ícone do item: quadro parado de frente da própria peça, recortado no que tem pixel e reduzido
const icones = {};
function iconeItem(it) {
  const k = it.base + "|" + it.qual;
  if (icones[k]) return icones[k];
  if (!IMG[arqDe(baseItem(D.itens, it.base).visual.walk)]) return "";
  const b = baseItem(D.itens, it.base), v = b.visual, img = pecaTingida(v.walk, it.qual, b.material), col = v.walk.coluna || 0, lin = b.icone_linha ?? 2;
  const t = document.createElement("canvas"); t.width = 64; t.height = 64;
  const tx = t.getContext("2d");
  if (v.fundo && v.fundo.walk) tx.drawImage(pecaTingida(v.fundo.walk, it.qual, b.material), col * 64, lin * 64, 64, 64, 0, 0, 64, 64);
  tx.drawImage(img, col * 64, lin * 64, 64, 64, 0, 0, 64, 64);
  const px = tx.getImageData(0, 0, 64, 64).data; let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (px[(y * 64 + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const lado = Math.max(8, x1 - x0 + 1, y1 - y0 + 1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const c = document.createElement("canvas"); c.width = 32; c.height = 32;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(t, Math.round(cx - lado / 2), Math.round(cy - lado / 2), lado, lado, 0, 0, 32, 32);
  return (icones[k] = c.toDataURL());
}
const imgIcone = (it) => `<img class="ic" alt="" src="${iconeItem(it)}">`;

// camadas do personagem na ordem da classe (itens.json "corpo"[classe].ordem): corpo, cabeça, extras da classe
// (aljava, flecha), "fundo_arma" (parte de trás do arco) e cada item vestido; folhas "grandes" (192 px) ficam centradas
function camadas(anim, equip = EST.equip) {
  const I = D.itens, corpo = I.corpo[EST.classe], out = [];
  for (const c of corpo.ordem) {
    if (c === "corpo") out.push({ img: IMG[`${corpo.base}/${anim}.png`] });
    else if (c === "cabeca") out.push({ img: IMG[`${corpo.cabeca}/${anim}.png`] });
    else if (corpo.extras && corpo.extras[c]) { const e = corpo.extras[c][anim]; if (e) out.push({ img: IMG[arqDe(e)], coluna: e.coluna }); }
    else if (c.startsWith("fundo:")) { // parte de trás de capa, escudo e arco
      const it = equip[c.slice(6)], b = it && baseItem(I, it.base), f = b && b.visual.fundo;
      if (f && f[anim]) out.push({ img: pecaTingida(f[anim], it.qual, b.material), coluna: f[anim].coluna });
    } else {
      const it = equip[c]; if (!it) continue;
      const b = baseItem(I, it.base), v = b.visual; if (!v[anim]) continue;
      out.push({ img: pecaTingida(v[anim], it.qual, b.material), grande: (v.grande || []).includes(anim), coluna: v[anim].coluna });
    }
  }
  return out;
}
function desenharCamadas(anim, col, linha, ox, oy, alvo = ctx, equip = EST.equip) {
  for (const l of camadas(anim, equip)) {
    if (!l.img) continue;
    const c = l.coluna ?? col;
    if (l.grande) alvo.drawImage(l.img, c * 192, linha * 192, 192, 192, ox - 64, oy - 64, 192, 192);
    else alvo.drawImage(l.img, c * 64, linha * 64, 64, 64, ox, oy, 64, 64);
  }
}
function armaSemEstocar() { const a = EST.equip.arma; return !!(a && baseItem(D.itens, a.base).estocada_com_golpe); }
function desenharJogador(t) {
  const g = jogador.golpe, h = jogador.hab;
  const dir = g >= 0 && h.animacao === "giro" ? ORDEM_GIRO[(ORDEM_GIRO.indexOf(jogador.dir) + Math.floor(g / h.duracao * 4)) % 4] : jogador.dir;
  const L = LINHA[dir], ox = Math.round(jogador.x - 32 - cam.x), oy = Math.round(jogador.y - 60 - cam.y);
  ctx.fillStyle = "#0005"; ctx.beginPath(); ctx.ellipse(Math.round(jogador.x - cam.x), Math.round(jogador.y - 1 - cam.y), 12, 4, 0, 0, 7); ctx.fill(); // sombra
  desenharAura(t);
  if (jogador.invul > 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.5;
  if (g >= 0 && h.animacao === "shoot") desenharCamadas("shoot", Math.min(12, Math.floor(g / Math.min(h.duracao, 0.55) * 13)), L, ox, oy);
  else if (g >= 0 && h.animacao === "thrust" && !armaSemEstocar()) desenharCamadas("thrust", Math.min(7, Math.floor(g / h.duracao * 8)), L, ox, oy);
  else if (g >= 0 && h.animacao === "thrust") desenharCamadas("slash", Math.min(5, Math.floor(g / h.duracao * 6)), L, ox, oy); // improviso: arma sem estocar
  else if (g >= 0) { // golpe e giro usam a animação de golpear; o giro troca de direção 4 vezes
    const passo = h.animacao === "giro" ? h.duracao / 4 : h.duracao;
    desenharCamadas("slash", Math.min(5, Math.floor((g % passo) / passo * 6)), L, ox, oy);
    if (h.animacao === "giro") { ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = "#dfefff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(jogador.x - cam.x, jogador.y - 14 - cam.y, h.raio, h.raio * 0.7, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  } else desenharCamadas("walk", jogador.andando ? 1 + Math.floor(jogador.tAnim * 10) % 8 : 0, L, ox, oy);
  ctx.globalAlpha = 1;
  if (g >= 0 && (h.animacao === "slash" || h.animacao === "giro" || (h.animacao === "thrust" && armaSemEstocar()))) desenharRastro(dir, g, h);
  desenharBrilhoArma(t, dir);
}
// aura nos pés conforme a melhor qualidade vestida (Raro: azul; Lendário: dourada com faíscas)
// aura nos pés: conjunto completo (cor do conjunto) ou melhor qualidade vestida (Raro azul; Lendário dourada com faíscas)
function desenharAura(t) {
  const ordem = D.itens.qualidades.map((q) => q.id), x = jogador.x - cam.x, y = jogador.y - 2 - cam.y, p = 0.5 + 0.5 * Math.sin(t * 3);
  const completo = conjuntosAtivos(D.itens, EST.equip).find((c) => c.completo);
  const melhor = Math.max(-1, ...Object.values(EST.equip).filter(Boolean).map((it) => ordem.indexOf(it.qual)));
  if (completo) { // conjunto completo: anel de luz com a cor do conjunto
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = completo.conjunto.cor; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35 + 0.3 * p; ctx.beginPath(); ctx.ellipse(x, y, 18 + 3 * p, 7 + p, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.15 + 0.1 * p; ctx.fillStyle = completo.conjunto.cor; ctx.fill(); ctx.restore();
  }
  if (melhor < ordem.indexOf("raro")) return;
  const q = D.itens.qualidades[melhor];
  ctx.save(); ctx.fillStyle = q.cor; ctx.globalAlpha = 0.18 + 0.12 * p;
  ctx.beginPath(); ctx.ellipse(x, y, 16 + 2 * p, 6 + p, 0, 0, 7); ctx.fill();
  if (q.id === "lendario") { ctx.globalAlpha = 0.9; for (let k = 0; k < 3; k++) { const a = t * 2 + k * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 14), Math.round(y - 18 + Math.sin(a * 1.3) * 16), 2, 2); } }
  ctx.restore();
}
// brilho do +N na arma (luz somada, sem imagem): +3 halo, +4 halo mais forte, +5 faíscas
const MAO = { down: [10, -26], up: [-10, -28], left: [-14, -26], right: [14, -26] };
function desenharBrilhoArma(t, dir) {
  const a = EST.equip.arma, cfg = D.itens.brilho;
  if (!a || a.mais < cfg.a_partir_de) return;
  const q = qualidade(D.itens, a.qual), cor = a.qual === "comum" ? "#fff2c0" : q.cor, [mx, my] = MAO[dir];
  const x = jogador.x + mx - cam.x, y = jogador.y + my - cam.y, p = 0.6 + 0.4 * Math.sin(t * 5), r = 8 + 4 * (a.mais - cfg.a_partir_de) + 2 * p;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, cor); gr.addColorStop(1, "#0000");
  ctx.globalAlpha = 0.25 + 0.12 * (a.mais - cfg.a_partir_de) + 0.1 * p; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (a.mais >= cfg.faiscas_em) { ctx.globalAlpha = 1; ctx.fillStyle = "#fff";
    for (let k = 0; k < 4; k++) { const ang = t * 3 + k * 1.57, d = 6 + 6 * ((t * 2 + k * 0.37) % 1); ctx.fillRect(Math.round(x + Math.cos(ang) * d), Math.round(y + Math.sin(ang) * d - ((t * 20 + k * 5) % 10)), 1, 1); } }
  ctx.restore();
}
// rastro da arma ao golpear: cor da qualidade da arma, mais forte com o +N
const ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
function desenharRastro(dir, g, h) {
  const arma = EST.equip.arma; if (!arma) return;
  const q = qualidade(D.itens, arma.qual), passo = h.animacao === "giro" ? h.duracao / 4 : h.duracao, f = (g % passo) / passo;
  const a0 = ANG[dir] - 1.2, a = a0 + 2.4 * Math.min(1, f * 1.4);
  ctx.save(); ctx.strokeStyle = arma.qual === "comum" ? "#ffffff" : q.cor; ctx.globalAlpha = (0.25 + 0.08 * arma.mais) * (1 - f * 0.6);
  ctx.lineWidth = 2 + 0.6 * arma.mais; ctx.beginPath(); ctx.arc(jogador.x - cam.x, jogador.y - 22 - cam.y, 24, a0, a); ctx.stroke(); ctx.restore();
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
    else if (o.nome && IMG["cidade/" + o.nome]) { const im = IMG["cidade/" + o.nome]; ctx.drawImage(im, px, py + o.h * TILE - im.height); }
    else ctx.drawImage(IMG.house, 0, 0, 192, 160, px, py, 192, 160);
  } });
  for (const n of mapa.npcs) fila.push({ y: n.y * TILE + 28, f: () => {
    const px = n.x * TILE - cam.x, py = n.y * TILE - cam.y;
    if (n.tipo === "quadro") { etiqueta(NOMES[n.tipo], px + 16, py - 98); return; } // o quadro é a construção logo acima
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
  desenharEfeitos(1 / 60);
  for (const c of chao) if (c.it.qual !== "comum") etiqueta(nomeItem(D.itens, c.it), Math.round(c.x - cam.x), Math.round(c.y - cam.y) - 12); // nomes por cima de tudo
  for (let i = flutuantes.length - 1; i >= 0; i--) { const f = flutuantes[i]; f.t -= 1 / 60; f.y -= 0.4; if (f.t <= 0) { flutuantes.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2); ctx.font = "bold 9px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#000b"; ctx.fillText(f.txt, f.x - cam.x + 1, f.y - cam.y + 1); ctx.fillStyle = f.cor; ctx.fillText(f.txt, f.x - cam.x, f.y - cam.y); ctx.restore(); }
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
