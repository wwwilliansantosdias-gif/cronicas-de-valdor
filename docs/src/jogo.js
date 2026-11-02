import { lerMapaTexto, gerarMapa, TILE, bloqueadoTile } from "./mapa.js";
import { novoEstado, ganharXp, portalLiberado, aoMorrer, xpParaProximo } from "./progresso.js";
import { carregar, guardar, apagar } from "./salvar.js";
import { criarMonstro, atualizarMonstro, atingir, danoHabilidade, recargaHabilidade, mover, direcaoDe } from "./combate.js";
import { derivados, aoSubir, distribuirRecomendado } from "./personagem.js";

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

let D, IMG, EST, MAPAS = {}, mapa, jogador, monstros = [], chefeDef, msgT = 0, parado = false, ultimoSave = 0;
const MSTR = {};

function msg(t, s = 2.4) { $("msg").textContent = t; $("msg").classList.add("on"); msgT = s; }
function salvar() { guardar(localStorage, EST); }

async function iniciar() {
  const [regioes, mons, itens, missoes, mostr, prog, classes, habs] = await Promise.all(["dados/regioes.json", "dados/monstros.json", "dados/itens.json", "dados/missoes.json", "mostruario/mostruario.json", "dados/progressao.json", "dados/classes.json", "dados/habilidades.json"].map(json));
  D = { regioes: regioes.regioes, mapasTxt: regioes.mapas, monstros: Object.fromEntries(mons.monstros.map((m) => [m.id, m])), itens, missoes: missoes.missoes,
    P: prog, classes: Object.fromEntries(classes.classes.map((c) => [c.id, c])), hab: Object.fromEntries(habs.habilidades.map((h) => [h.id, h])), porGrau: habs.por_grau };
  for (const m of mostr.monstros) MSTR[m.id] = m;
  const arq = ["forest_tiles", "dirt", "signs", "house", "soldier", "soldier_altcolor", "princess", "guerreiro_walk", "guerreiro_slash", "guerreiro_slash_arma"];
  IMG = Object.fromEntries(await Promise.all(arq.map(async (n) => [n, await imagem(`assets/${n}.png`)])));
  const usados = new Set();
  for (const id in D.monstros) { const s = MSTR[D.monstros[id].sprite]; for (const k of ["andar", "ataque"]) if (s[k]) usados.add(s[k].file); }
  for (const f of usados) IMG[f] = await imagem("mostruario/" + f);
  for (const [id, f] of Object.entries(D.mapasTxt)) MAPAS[id] = gerarMapa(lerMapaTexto(await texto(f)));
  EST = carregar(D.P, D.itens, localStorage, Object.keys(MAPAS)) || novoEstado(D.P, D.itens);
  if (EST.autoDistribuir && EST.pontosLivres > 0) distribuirRecomendado(D.P, EST, D.classes[EST.classe].recomendado);
  jogador = { x: 0, y: 0, dir: "down", vida: 0, morto: false, andando: false, tAnim: 0, golpe: -1, recarga: 0, invul: 0 };
  entrar(EST.mapa, null);
  jogador.vida = stats().vidaMax;
  document.body.dataset.pronto = "1";
  requestAnimationFrame(quadro);
}

function entrar(id, origem) {
  EST.mapa = id; mapa = MAPAS[id]; monstros = [];
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
addEventListener("keydown", (e) => { teclas.add(e.key.toLowerCase()); if (e.key === " ") atacar(); if (e.key.toLowerCase() === "e") interagir(); if (e.key.toLowerCase() === "q") usarPocao(); });
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
$("bP").addEventListener("pointerdown", () => usarPocao());
$("bE").addEventListener("pointerdown", () => interagir());
$("bM").addEventListener("pointerdown", () => menu());

function stats() { return derivados(D.P, D.itens, EST); }
function subiuNiveis(n) {
  if (!n) return;
  aoSubir(D.P, EST, n, D.classes[EST.classe].recomendado);
  jogador.vida = stats().vidaMax; msg(`Nível ${EST.nivel}!`);
}

function atacar() {
  if (parado || jogador.morto || jogador.recarga > 0 || mapa.zonaSegura) return;
  const h = D.hab.golpe, sv = stats();
  jogador.golpe = 0; jogador.hab = h; jogador.recarga = recargaHabilidade(h, D.porGrau, sv.recargaMult, EST.habilidades[h.id] || 1);
}
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
  const f = document.createElement("button"); f.textContent = "Fechar"; f.onclick = fechar; $("caixa").appendChild(f);
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
  painel(`<h3>Mercador</h3><p>Ouro: ${EST.ouro} · Poções: ${EST.pocoes}</p>`, [[`Comprar poção de vida (${preco} ouro)`, () => { if (EST.ouro >= preco) { EST.ouro -= preco; EST.pocoes++; salvar(); telaMercador(); } }, EST.ouro < preco]]);
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
async function menu() {
  if (parado) return;
  painel(`<h3>Menu</h3><p>Nível ${EST.nivel} · ${EST.ouro} ouro</p>`, [
    ["Créditos", async () => { let t = "Não foi possível carregar."; try { t = await texto("CREDITOS.md"); } catch { /* sem rede */ } painel(`<h3>Créditos</h3><pre></pre>`); $("caixa").querySelector("pre").textContent = t; }],
    ["Mostruário de arte", () => { location.href = "mostruario/"; }],
    ["Apagar progresso e recomeçar", () => { if (confirm("Apagar o progresso salvo?")) { apagar(localStorage); location.reload(); } }],
  ]);
}

// ---------- atualização ----------
function atualizar(dt) {
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $("msg").classList.remove("on"); }
  jogador.recarga = Math.max(0, jogador.recarga - dt); jogador.invul = Math.max(0, jogador.invul - dt);
  const sv = stats();
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
    for (const m of monstros) {
      if (m.morto) { if (m.def.comportamento !== "chefe" ? performance.now() - m.mortoEm > 25000 : performance.now() - m.mortoEm > 120000) { Object.assign(m, criarMonstro(m.def, m.spawnX, m.spawnY)); } continue; }
      const d = atualizarMonstro(m, jogador, dt, mapa);
      if (d && jogador.invul <= 0) { jogador.vida -= d; jogador.invul = 0.5; if (jogador.vida <= 0) morrer(); }
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
  $("hpb").firstChild.style.width = Math.max(0, jogador.vida / sv.vidaMax * 100) + "%";
  $("xpb").firstChild.style.width = (EST.nivel >= D.P.nivel_max ? 100 : EST.xp / xpParaProximo(D.P, EST.nivel) * 100) + "%";
  $("info").textContent = `${EST.ouro} ouro · ${EST.pocoes} ${EST.pocoes === 1 ? "poção" : "poções"}`;
}
function morrer() {
  jogador.morto = true; aoMorrer(EST); salvar();
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
  const atq = m.estado === "atacar" && spec.ataque;
  const a = atq ? spec.ataque : spec.andar;
  const linha = a.rows[m.dir] ?? a.rows.down ?? Object.values(a.rows)[0];
  const fr = atq ? a.frames[Math.min(a.frames.length - 1, Math.floor(m.t / 0.9 * a.frames.length))] : quadroAnim(a, t, m.spawnX);
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
function desenharJogador(t) {
  const L = LINHA[jogador.dir], ox = Math.round(jogador.x - 32 - cam.x), oy = Math.round(jogador.y - 60 - cam.y);
  if (jogador.invul > 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.5;
  if (jogador.golpe >= 0) {
    const c = Math.min(5, Math.floor(jogador.golpe / 0.07));
    ctx.drawImage(IMG.guerreiro_slash, c * 64, L * 64, 64, 64, ox, oy, 64, 64);
    ctx.drawImage(IMG.guerreiro_slash_arma, c * 192, L * 192, 192, 192, ox - 64, oy - 64, 192, 192);
  } else {
    const c = jogador.andando ? 1 + Math.floor(jogador.tAnim * 10) % 8 : 0;
    ctx.drawImage(IMG.guerreiro_walk, c * 64, L * 64, 64, 64, ox, oy, 64, 64);
  }
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
  for (const m of monstros) if (!m.morto) fila.push({ y: m.y, f: () => desenharMonstro(m, t) });
  if (!jogador.morto) fila.push({ y: jogador.y, f: () => desenharJogador(t) });
  fila.sort((a, b) => a.y - b.y); for (const q of fila) q.f();
}

let antes = 0, acum = 0;
function quadro(agora) {
  const dt = Math.min(0.1, (agora - antes) / 1000 || 0); antes = agora; acum += dt;
  while (acum >= 1 / 60) { atualizar(1 / 60); acum -= 1 / 60; }
  desenhar(agora / 1000);
  requestAnimationFrame(quadro);
}
window.__valdor = { get est() { return EST; }, get mapa() { return mapa; }, get jogador() { return jogador; }, get monstros() { return monstros; }, entrar, atacar, interagir };
iniciar().catch((e) => { document.body.insertAdjacentHTML("beforeend", `<pre style="position:fixed;inset:0;background:#300;padding:12px;z-index:20;white-space:pre-wrap">Erro ao iniciar: ${String(e.message).replace(/</g, "&lt;")}</pre>`); console.error(e); });
