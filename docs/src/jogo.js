import { lerMapaTexto, gerarMapa, TILE, bloqueadoTile } from "./mapa.js";
import { novoEstado, ganharXp, portalLiberado, aoMorrer, xpParaProximo } from "./progresso.js";
import { carregar, guardar, apagar } from "./salvar.js";
import { criarMonstro, atualizarMonstro, atingir, danoHabilidade, recargaHabilidade, escalarArea, mover, direcaoDe, dentroDaArea, VET } from "./combate.js";
import { sortearDrop, nomeItem, precoVenda, pegar, equipar, desequipar, descartar, vender, impedimento, melhorar, proximaMelhoria, itemDoAlvo, sortearFragmentos } from "./itens.js";
import { normalizar, alternar, aleatoria, opcoes, opcao, recolorir, CAMPOS, NOMES_CAMPO } from "./aparencia.js";
import { dados as dadosEquip, camadasDoPersonagem, camadasDoItem, ordenarPorZ, efeitos as efeitosDe, raridade, estocadaUsaGolpe, CacheRecolor } from "./equipamento.js";
import { contornoDe, corDoItem, pulso, desenharAura as desenharAuraEf, desenharClarao, Particulas, desenharImpacto } from "./efeitos_visuais.js";
import { derivados, estatisticas, danoRecebido, equipamentoInicial, valoresItem, baseItem, qualidade, conjuntosAtivos, aoSubir, distribuirRecomendado, distribuir, redistribuir, custoRedistribuir, gastos, desbloquearHabilidades, melhorarHabilidade } from "./personagem.js";

const $ = (id) => document.getElementById(id);
const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const texto = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.text(); });
const imagem = (u) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("imagem " + u)); i.src = u; });
const LINHA = { up: 0, left: 1, down: 2, right: 3 };

const tela = $("tela"), ctx = tela.getContext("2d");
let Z = 2, VW = 0, VH = 0;
function ajustar() {
  Z = Math.max(1, Math.floor(Math.min(innerWidth / 384, innerHeight / 192) * 2) / 2); // passos de 0,5: celular deitado baixo fica em 1,5×
  VW = Math.floor(innerWidth / Z); VH = Math.floor(innerHeight / Z);
  tela.width = VW; tela.height = VH; tela.style.width = VW * Z + "px"; tela.style.height = VH * Z + "px";
  ctx.imageSmoothingEnabled = false;
}
addEventListener("resize", ajustar); ajustar();

let D, IMG, EST, MAPAS = {}, mapa, jogador, monstros = [], chao = [], avisoCheia = 0, chefeDef, msgT = 0, parado = false, ultimoSave = 0;
const MSTR = {};

// flechas visuais (desenhadas em código): o dano vem da forma da habilidade no "impacto"; aqui é só o que se vê
const SOLTAR = 0.32, efeitos = [], zonas = [];
// efeitos de magia em folha (dados/efeitos.json): no alvo, correndo à frente, em volta, no jogador ou à distância
function efeitoFolha(h, j, golpes) {
  const e = h.efeito, f = D.EF[e.folha], [vx, vy] = VET[j.dir];
  const img = f.img ? IMG[f.img] : IMG[f.img_por_direcao[j.dir]], base = { tipo: "folha", f, img, t: 0, dur: f.dur };
  if (e.onde === "alvo") { const alvos = golpes.length ? golpes.map((g) => g.m) : [{ x: j.x + vx * h.alcance, y: j.y + vy * h.alcance }]; for (const m of alvos) efeitos.push({ ...base, x: m.x, y: m.y - 16 }); }
  else if (e.onde === "corre") efeitos.push({ ...base, x0: j.x + vx * 16, y0: j.y - 20 + vy * 8, x1: j.x + vx * h.alcance, y1: j.y - 20 + vy * h.alcance });
  else if (e.onde === "volta") for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; efeitos.push({ ...base, x: j.x + Math.cos(a) * h.raio * 0.7, y: j.y + Math.sin(a) * h.raio * 0.45 - 8, t: -k * 0.02 }); }
  else if (e.onde === "jogador") efeitos.push({ ...base, segue: j, dur: h.duracao_efeito, y: -26 });
  else if (e.onde === "distancia") efeitos.push({ ...base, x: j.x + vx * h.distancia, y: j.y - 24 + vy * h.distancia, dur: (h.tiques || 1) * (h.intervalo || 0.5) });
}
function soltarFlechas(h) {
  const [vx, vy] = VET[jogador.dir], ox = jogador.x, oy = jogador.y - 26, ang = Math.atan2(vy, vx);
  const efA = efeitosArma(), rastro = efA ? efA.rastro : 0, corR = efA ? efA.cor : "#ffffff"; // rastro da flecha pela raridade
  if (h.forma === "linha") {
    const alvo = monstros.filter((m) => !m.morto && dentroDaArea(jogador, m, h)).sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy))[0];
    const d = alvo ? Math.hypot(alvo.x - ox, alvo.y - 12 - oy) : h.alcance;
    efeitos.push({ tipo: "voo", x0: ox, y0: oy, ang, d, t: 0, dur: d / 900, rastro, corR });
  } else if (h.forma === "leque") {
    for (let k = 0; k < h.flechas; k++) { const a = ang + ((k / (h.flechas - 1)) - 0.5) * h.angulo * Math.PI / 180; efeitos.push({ tipo: "voo", x0: ox, y0: oy, ang: a, d: h.alcance, t: 0, dur: h.alcance / 900, rastro, corR }); }
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
    if (e.tipo === "folha") { // quadro da folha de efeito, centrado no ponto
      const f = e.f, q = f.repete ? Math.floor(e.t / f.dur * f.quadros) % f.quadros : Math.min(f.quadros - 1, Math.floor(p * f.quadros));
      const sx = (q % f.colunas) * f.fw, sy = (f.linha0 + Math.floor(q / f.colunas)) * f.fw, lado = Math.round(f.fw * f.escala);
      const x = e.segue ? e.segue.x : e.x0 != null ? e.x0 + (e.x1 - e.x0) * p : e.x, y = e.segue ? e.segue.y + e.y : e.y0 != null ? e.y0 + (e.y1 - e.y0) * p : e.y;
      if (e.segue) ctx.globalAlpha = 0.75;
      if (e.img) ctx.drawImage(e.img, sx, sy, f.fw, f.fw, Math.round(x - lado / 2 - cam.x), Math.round(y - lado / 2 - cam.y), lado, lado);
    } else if (e.tipo === "voo") { // 2,5D: a flecha sobe e desce em arco; a sombra corre reta no chão
      const gx = e.x0 + Math.cos(e.ang) * e.d * p - cam.x, gy = e.y0 + 22 + Math.sin(e.ang) * e.d * p - cam.y;
      const alt = Math.sin(Math.PI * p) * Math.min(26, e.d * 0.12) + 22, x = gx, y = gy - alt;
      const inc = Math.cos(Math.PI * p) * 0.6, dx = Math.cos(e.ang), dy = Math.sin(e.ang) - inc * Math.abs(Math.cos(e.ang));
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#000"; ctx.fillRect(Math.round(gx - 4), Math.round(gy), 8, 2); ctx.restore();
      if (e.rastro) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = e.corR; ctx.lineWidth = 1 + 2 * e.rastro; ctx.globalAlpha = 0.35 + 0.5 * e.rastro;
        ctx.beginPath(); ctx.moveTo(x - dx * (18 + 22 * e.rastro), y - dy * (18 + 22 * e.rastro)); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(x - dx * 16, y - dy * 16); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
    } else if (e.tipo === "impacto") { desenharImpacto(ctx, e.x - cam.x, e.y - cam.y, e.forca, p, e.cor);
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
function flutuar(txt, x, y, cor, tam = 9) { flutuantes.push({ txt, x, y, cor, tam, t: 1.2 }); }
function msg(t, s = 2.4) { $("msg").style.color = ""; $("msg").textContent = t; $("msg").classList.add("on"); msgT = s; }
function salvar() { guardar(localStorage, EST); }

async function iniciar() {
  const [regioes, mons, itens, missoes, mostr, prog, classes, habs, cen, apar, efe, lpc, rar] = await Promise.all(["dados/regioes.json", "dados/monstros.json", "dados/itens.json", "dados/missoes.json", "mostruario/mostruario.json", "dados/progressao.json", "dados/classes.json", "dados/habilidades.json", "dados/cenario.json", "dados/aparencia.json", "dados/efeitos.json", "dados/lpc_definicoes.json", "dados/raridades.json"].map(json));
  D = { regioes: regioes.regioes, mapasTxt: regioes.mapas, monstros: Object.fromEntries(mons.monstros.map((m) => [m.id, m])), itens, missoes: missoes.missoes,
    CEN: cen, AP: apar, EF: efe, P: prog, classes: Object.fromEntries(classes.classes.map((c) => [c.id, c])), hab: Object.fromEntries(habs.habilidades.map((h) => [h.id, h])), porGrau: habs.por_grau };
  D.EQ = dadosEquip({ defs: lpc, catalogo: itens, raridades: rar }); // equipamento: peças, cores e efeitos (etapas 11 e 12)
  for (const m of mostr.monstros) MSTR[m.id] = m;
  const arq = ["forest_tiles", "dirt", "cavern_ruins", "signs", "house", "soldier", "soldier_altcolor", "princess", ...["casa_tijolo", "casa_pedra", "fonte", "barraca", "quadro", "forja", "poco"].map((c) => "cidade/" + c)];
  for (const [k, e] of Object.entries(efe)) if (k[0] !== "_") arq.push(...(e.img ? [e.img] : Object.values(e.img_por_direcao)));
  IMG = Object.fromEntries(await Promise.all(arq.map(async (n) => [n, await imagem(`assets/${n}.png`)])));
  const usados = new Set();
  for (const id in D.monstros) { const s = MSTR[D.monstros[id].sprite]; for (const k of ["andar", "ataque"]) if (s[k]) usados.add(s[k].file); }
  for (const f of usados) IMG[f] = await imagem("mostruario/" + f);
  for (const [id, f] of Object.entries(D.mapasTxt)) MAPAS[id] = gerarMapa(lerMapaTexto(await texto(f)));
  EST = carregar(D.P, D.itens, localStorage, Object.keys(MAPAS));
  if (!EST) { const c = await escolherClasse(), ap = await criarAparencia(c); EST = novoEstado(D.P, D.itens, c, D.classes[c].habilidades[0], ap); }
  EST.aparencia = normalizar(D.AP, EST.aparencia); // heróis de saves antigos ganham a aparência padrão
  await precarregar(arquivosDo(EST.equip, EST.classe, EST.aparencia)); // o herói aparece completo já no primeiro quadro
  if (EST.autoDistribuir && EST.pontosLivres > 0) distribuirRecomendado(D.P, EST, D.classes[EST.classe].recomendado);
  desbloquearHabilidades(EST, habsDaClasse()); // saves anteriores ganham as habilidades que o nível já libera
  jogador = { x: 0, y: 0, dir: "down", vida: 0, morto: false, andando: false, tAnim: 0, golpe: -1, cds: {}, invul: 0, veneno: null, semDano: 0, clarao: -1 };
  entrar(EST.mapa, null);
  jogador.vida = stats().vidaMax;
  document.body.dataset.pronto = "1";
  requestAnimationFrame(quadro);
}

function entrar(id, origem) {
  EST.mapa = id; mapa = MAPAS[id]; monstros = []; chao = [];
  let p = mapa.inicio;
  if (origem && origem.startsWith("portal:")) { const pt = mapa.portais.find((x) => x.para === origem.slice(7)); p = pt ? { x: pt.x - 2, y: pt.y + 1 } : { x: 16, y: 14 }; }
  else if (origem) { const s = mapa.saidas.find((x) => x.destino === origem); if (s) p = s.entrada; }
  if (!origem && mapa.zonaSegura) p = { x: 16, y: 14 };
  if (mapa.zonaSegura && D && EST.atributos) jogador.vida = stats().vidaMax; // a cidade restaura a vida
  jogador.x = p.x * TILE + 16; jogador.y = p.y * TILE + 28;
  for (const s of mapa.spawns) monstros.push(criarMonstro(D.monstros[s.tipo], s.x * TILE + 16, s.y * TILE + 28));
  if (mapa.chefe) monstros.push(criarMonstro(D.monstros[mapa.chefe.tipo], mapa.chefe.x * TILE + 16, mapa.chefe.y * TILE + 28));
  salvar();
}

// ---------- entrada ----------
const teclas = new Set(), joy = { x: 0, y: 0, id: null };
addEventListener("keydown", (e) => { const k = e.key.toLowerCase(); teclas.add(k); if (k === " ") atacar(); if (k === "1") usarHabilidade(habN(1)); if (k === "2") usarHabilidade(habN(2)); if (k === "3") usarHabilidade(habN(3)); if (k === "4") usarHabilidade(habN(4)); if (k === "e") interagir(); if (k === "q") usarPocao(); });
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
$("bH3").addEventListener("pointerdown", () => usarHabilidade(habN(3)));
$("bH4").addEventListener("pointerdown", () => usarHabilidade(habN(4)));
// n-ésima habilidade da classe (0 = ataque básico; 1 a 4 = botões de habilidade)
function habN(n) { return D.classes[EST.classe].habilidades[n]; }
// personagem novo: escolha da classe
function escolherClasse() {
  return new Promise((ok) => {
    const cs = Object.values(D.classes).filter((c) => c.implementada);
    const desc = { guerreiro: "Corpo a corpo: Golpe, Estocada e Giro. Aguenta mais pancada.", arqueiro: "À distância: Disparo, Dispersão (acerta vários de uma vez) e Chuva de flechas.", mago: "Feitiços: Faísca, Leão de Fogo, Espinhos de Gelo, Escudo de Gelo e Tornado. Muito dano em área, pouca vida." };
    painel(`<h3>Novo personagem</h3><p>Escolha a classe:</p>${cs.map((c) => `<p><b>${c.nome}</b>: <small>${desc[c.id] || ""}</small></p>`).join("")}`, cs.map((c) => [c.nome, () => { fechar(); ok(c.id); }]));
    $("caixa").querySelector(".fechar")?.remove();
  });
}
// linhas "◀ Cabelo: Liso ▶" da aparência (criação e aba Aparência)
function linhasAparencia(ap) {
  return CAMPOS.map((c) => `<div class="atr ap"><button data-ap="${c}" data-p="-1" aria-label="${NOMES_CAMPO[c]} anterior">◀</button><div><small>${NOMES_CAMPO[c]}</small><br><b>${opcao(D.AP, ap, c).nome}</b></div><button data-ap="${c}" data-p="1" aria-label="${NOMES_CAMPO[c]} seguinte">▶</button></div>`).join("");
}
// personagem novo: depois da classe, a aparência (com boneco andando)
function criarAparencia(classe) {
  return new Promise((ok) => {
    let ap = aleatoria(D.AP);
    const tela = () => {
      painel(`<h3>Aparência <small>· ${D.classes[classe].nome}</small></h3><div class="pers"><div class="esq"><canvas id="previa" class="grande" width="64" height="64" aria-label="personagem"></canvas><small>Toque no boneco para girar</small></div><div class="dirp"><div class="conteudo apgrade">${linhasAparencia(ap)}</div></div></div>`,
        [["Sortear", () => { ap = aleatoria(D.AP); tela(); }], ["Começar", () => { fechar(); ok(ap); }]]);
      const cx = $("caixa"); cx.querySelector(".fechar")?.remove(); cx.style.width = "720px";
      for (const b of cx.querySelectorAll("button[data-ap]")) b.onclick = () => { ap = alternar(D.AP, ap, b.dataset.ap, +b.dataset.p); tela(); };
      const cv = $("previa"); cv.onclick = () => { ABA.dir = ORDEM_GIRO[(ORDEM_GIRO.indexOf(ABA.dir) + 1) % 4]; };
      animarPrevia(cv, { ...equipamentoInicial(D.itens, classe), capacete: null }, classe, () => ap); // sem chapéu, para ver o cabelo
      encaixarPainel();
    };
    tela();
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
  const reg = regiaoDoMapa(mapa.id);
  const it = sortearDrop(D.itens, D.P, def, EST, reg ? reg.niveis[1] : EST.nivel, stats().atributos.sor, Math.random, reg && reg.drops);
  if (it) chao.push({ it, x: m.x, y: m.y - 4, t: D.itens.drops.duracao_no_chao_s });
  const frag = sortearFragmentos(D.itens, def, Math.random);
  if (frag) { EST.fragmentos += frag; flutuar(`+${frag} fragmento${frag > 1 ? "s" : ""}`, m.x, m.y - 40, "#c9d4ff"); }
  salvar();
}

// ---------- interação ----------
function regiaoDoMapa(id) { return D.regioes.find((r) => r.cidade === id || r.cacada === id); }
function perto() {
  const alvos = mapa.npcs.map((n) => ({ tipo: n.tipo, x: n.x * TILE + 16, y: n.y * TILE + 16 }));
  for (const pt of mapa.portais) alvos.push({ tipo: "portal", para: pt.para, x: pt.x * TILE + 16, y: pt.y * TILE + 16 });
  let melhor = null, md = 52;
  for (const a of alvos) { const d = Math.hypot(a.x - jogador.x, a.y - 12 - jogador.y); if (d < md) { md = d; melhor = a; } }
  return melhor;
}
function painel(html, acoes = []) {
  parado = true; $("caixa").innerHTML = html; $("caixa").style.width = ""; $("caixa").style.transform = "";
  for (const [t, fn, off] of acoes) { const b = document.createElement("button"); b.textContent = t; b.disabled = !!off; b.onclick = () => { fn(); }; $("caixa").appendChild(b); }
  const f = document.createElement("button"); f.textContent = "Fechar"; f.className = "fechar"; f.onclick = fechar; $("caixa").prepend(f);
  $("painel").classList.add("on");
  encaixarPainel();
}
function fechar() { parado = false; refazerPainel = null; $("painel").classList.remove("on"); }
// a caixa diminui de escala para caber em telas baixas (celular deitado com a barra do navegador); texto muito longo
// (como os Créditos) continua rolando em vez de ficar minúsculo
function encaixarPainel() {
  const c = $("caixa"); if (!$("painel").classList.contains("on")) return;
  c.style.transform = ""; c.style.maxHeight = "none"; c.style.maxWidth = "none";
  // telas largas (Personagem) têm largura de layout fixa e diminuem inteiras; as outras usam a largura do conteúdo
  const larg = c.querySelector(".pers") ? 840 : Math.min(820, Math.max(280, c.scrollWidth));
  c.style.width = larg + "px";
  const s = Math.min(1, (innerHeight - 10) / c.scrollHeight, (innerWidth - 10) / larg);
  if (s < 0.62) { c.style.maxHeight = "94vh"; c.style.maxWidth = ""; c.style.width = ""; return; }
  if (s < 1) c.style.transform = `scale(${s.toFixed(3)})`;
}
addEventListener("resize", encaixarPainel);
function interagir() {
  if (parado || jogador.morto) return;
  const a = perto(); if (!a) return;
  if (a.tipo === "mercador") return telaMercador();
  if (a.tipo === "ferreiro") return telaFerreiro();
  if (a.tipo === "quadro") return telaQuadro();
  if (a.tipo === "portal") {
    const dest = D.regioes.find((r) => r.id === a.para), aqui = regiaoDoMapa(mapa.id), min = dest.niveis[0];
    if (EST.nivel < min) return painel(`<h3>Portal selado</h3><p>O portal para a ${dest.nome} só reage a quem alcançar o nível ${min}. Você está no nível ${EST.nivel}.</p>`);
    if (!dest.implementada) return painel(`<h3>Portal aberto</h3><p>O caminho para a ${dest.nome} se abre, mas essa região ainda não foi construída.</p>`);
    entrar(dest.cidade, "portal:" + aqui.id); msg(dest.nome, 2.4);
  }
}
function telaMercador() {
  setTimeout(() => { refazerPainel = () => telaMercador(); });
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

const NOME_ESPACO = { arma: "Arma", escudo: "Mão sec.", capacete: "Cabeça", ombros: "Ombros", peitoral: "Peito", sobre_peito: "Sobre peito", bracos: "Braços", capa: "Costas", grevas: "Pernas", botas: "Pés", pescoco: "Pescoço" };
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
  if (v.defesa) partes.push(`defesa ${Math.round(v.defesa)}`);
  for (const [a, n] of Object.entries(v.atributos)) partes.push(`+${n} ${NOME_ATR[a][0]}`);
  return partes.join(", ");
}
// diferença em relação ao que está vestido no mesmo espaço (dano e vida finais do personagem)
function comparar(i) {
  const it = EST.mochila[i], esp = baseItem(D.itens, it.base).espaco, antes = stats();
  const copia = { ...EST, equip: { ...EST.equip, [esp]: it } }, depois = derivados(D.P, D.itens, copia);
  const f = (n, s = "") => (n > 0 ? `<span style="color:#7fd27f">+${n}${s}</span>` : n < 0 ? `<span style="color:#ff7a7a">${n}${s}</span>` : "=");
  return `dano ${f(+(depois.dano - antes.dano).toFixed(1))}, vida ${f(depois.vidaMax - antes.vidaMax)}, defesa ${f(depois.defesa - antes.defesa)}`;
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
const NOME_ATR_BASE = { for: ["Força", "dano"], vit: ["Vitalidade", "vida máxima e recuperação"], agi: ["Agilidade", "recarga dos ataques e velocidade"], sor: ["Sorte", "chance de crítico e de itens melhores"] };
// o Mago chama a Força de "Magia" (classes.json "nome_atributo"); o atributo é o mesmo
const NOME_ATR = new Proxy(NOME_ATR_BASE, { get: (t, a) => (EST && D.classes[EST.classe].nome_atributo?.[a]) || t[a] });
// mexer em atributos pode mudar a vida máxima: mantém a vida perdida, não a proporção
function comAjusteDeVida(fn) { const antes = stats().vidaMax, r = fn(); jogador.vida = Math.max(1, Math.min(stats().vidaMax, jogador.vida + stats().vidaMax - antes)); salvar(); return r; }
// ---------- tela de Personagem: boneco, números e abas (Equipamento, Atributos, Habilidades) ----------
const ABA = { aba: "equip", sel: -1, dir: "down" };
function telaMochila(sel = -1) { telaPersonagem("equip", sel); }
function telaAtributos() { telaPersonagem("atrib"); }
function telaHabilidades() { telaPersonagem("hab"); }
function numeros(est) { const sv = derivados(D.P, D.itens, est); return { sv, ...estatisticas(D.P, sv, D.hab[habN(0)]) }; }
function telaPersonagem(aba = ABA.aba, sel = -1) {
  if (aba === "equip" && sel === -1) precarregarMochila();
  setTimeout(() => { refazerPainel = () => telaPersonagem(ABA.aba, ABA.sel); });
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
    ["Vida", `${sv.vidaMax} <small>(+${sv.regen}/s)</small>`, dif(sv.vidaMax, dv?.vidaMax)],
    ["Defesa", `${sv.defesa} (−${Math.round(sv.reducao * 100)}%)`, dif(sv.defesa, dv?.defesa)],
    ["Velocidade", Math.round(sv.velocidade), dif(sv.velocidade, dv?.velocidade)],
    ["Crítico", `${Math.round(sv.critico * 100)}%`, dif(sv.critico * 100, dv?.critico * 100, 0, "%")],
  ].map(([k, v, d]) => `<tr><td>${k}</td><td>${v}${d}</td></tr>`).join("");
  const slot = (e) => { const it = equipPrevia[e]; if (!I.encaixes[e].classes.includes(EST.classe)) return `<span class="slot s-${e} vazio" title="${I.encaixes[e].nome}: não é da sua classe"><small>—</small></span>`;
    return `<button class="slot s-${e}${sel === e ? " sel" : ""}${it && it === provando ? " prova" : ""}" data-e="${e}" aria-label="${NOME_ESPACO[e]}" style="border-color:${it ? qualidade(I, it.qual).cor : "#fff3"}">${it ? imgIcone(it) + (it.mais ? `<i>+${it.mais}</i>` : "") : `<small>${NOME_ESPACO[e]}</small>`}</button>`; };
  const boneco = `<div class="boneco">${["capacete", "pescoco", "ombros", "bracos", "arma", "peitoral", "sobre_peito", "capa", "grevas", "botas", "escudo"].map(slot).join("")}<canvas id="previa" width="64" height="64" aria-label="personagem"></canvas></div>`;
  const resumoConjuntos = (eq) => conjuntosAtivos(I, eq).map((c) => `<span style="color:${c.conjunto.cor}">Conjunto ${c.conjunto.nome} ${c.n}/${c.total}</span>`).join(" · ");
  const abas = [["equip", "Equipamento"], ["visual", "Aparência"], ["atrib", `Atributos${EST.pontosLivres ? ` (+${EST.pontosLivres})` : ""}`], ["hab", `Habilidades${EST.pontosHab ? ` (+${EST.pontosHab})` : ""}`]]
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
  } else if (aba === "visual") {
    corpo = `<p class="det"><small>Muda na hora, sem custo. Toque no boneco para girar.</small></p>` + linhasAparencia(EST.aparencia) +
      `<div class="atr"><div><small>Combinação sorteada</small></div><button data-sorteio="1" style="width:auto;padding:0 12px">Sortear</button></div>`;
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
  for (const b of cx.querySelectorAll("button[data-ap]")) b.onclick = () => { EST.aparencia = alternar(D.AP, EST.aparencia, b.dataset.ap, +b.dataset.p); salvar(); telaPersonagem("visual"); };
  for (const b of cx.querySelectorAll("button[data-sorteio]")) b.onclick = () => { EST.aparencia = aleatoria(D.AP); salvar(); telaPersonagem("visual"); };
  for (const b of cx.querySelectorAll("button[data-h]")) b.onclick = () => { melhorarHabilidade(P, EST, b.dataset.h); salvar(); telaPersonagem("hab"); };
  const cv = $("previa"); cv.onclick = () => { ABA.dir = ORDEM_GIRO[(ORDEM_GIRO.indexOf(ABA.dir) + 1) % 4]; };
  animarPrevia(cv, equipPrevia);
}
// boneco da tela de Personagem: anda no lugar, com o equipamento (ou a prova) em camadas
function animarPrevia(cv, equip, classe, ap) {
  const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  const passo = (t) => {
    if (!document.body.contains(cv)) return;
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = "#0004"; x.beginPath(); x.ellipse(32, 60, 12, 4, 0, 0, 7); x.fill();
    desenharCamadas("walk", 1 + Math.floor(t / 100) % 8, LINHA[ABA.dir], 0, 0, x, equip, classe, typeof ap === "function" ? ap() : ap);
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
    [`Efeitos de brilho: ${efeitosLigados ? "ligados" : "desligados"}`, () => { efeitosLigados = !efeitosLigados; try { localStorage.setItem("valdor-efeitos", efeitosLigados ? "1" : "0"); } catch { /* sem armazenamento */ } particulasJogo.limpar(); menu(); }],
    ["Novo personagem (apaga o progresso)", () => { if (confirm("Apagar o progresso salvo e criar outro personagem?")) { apagar(localStorage); location.reload(); } }],
  ]);
}

// ---------- atualização ----------
function atualizar(dt) {
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $("msg").classList.remove("on"); }
  for (const k in jogador.cds) jogador.cds[k] = Math.max(0, jogador.cds[k] - dt);
  for (let i = zonas.length - 1; i >= 0; i--) { // áreas que ficam (Tornado): acertam a cada "intervalo"
    const z = zonas[i]; z.t -= dt; if (z.t > 0) continue;
    const sv0 = stats(), r = atingir(z.o, monstros, z.h, z.dano, sv0.critico, sv0.criticoMult);
    for (const gp of r.golpes) flutuar(gp.crit ? `${Math.round(gp.dano)}!` : `${Math.round(gp.dano)}`, gp.m.x, gp.m.y - 30 - 18 * gp.m.def.escala, gp.crit ? "#ffd84a" : "#ffffff", gp.crit ? 12 : 9);
    for (const m of r.mortos) registrarMorte(m);
    z.n--; z.t = z.h.intervalo; if (z.n <= 0 || mapa.zonaSegura) zonas.splice(i, 1);
  }
  particulasJogo.atualizar(dt);
  if (jogador.clarao >= 0) { jogador.clarao += dt; if (jogador.clarao > 0.2) jogador.clarao = -1; }
  if (jogador.escudo) { jogador.escudo.t -= dt; if (jogador.escudo.t <= 0) jogador.escudo = null; }
  if (jogador.repete && !jogador.morto) { // Rajada: as flechas seguintes saem em sequência
    const rp = jogador.repete; rp.t -= dt;
    if (rp.t <= 0) { const sv0 = stats(), r = atingir(jogador, monstros, rp.h, danoHabilidade(rp.h, D.porGrau, sv0.dano, EST.habilidades[rp.h.id] || 1), sv0.critico, sv0.criticoMult);
      soltarFlechas(rp.h); for (const gp of r.golpes) flutuar(gp.crit ? `${Math.round(gp.dano)}!` : `${Math.round(gp.dano)}`, gp.m.x, gp.m.y - 30 - 18 * gp.m.def.escala, gp.crit ? "#ffd84a" : "#ffffff", gp.crit ? 12 : 9);
      for (const m of r.mortos) registrarMorte(m); rp.n--; rp.t = 0.13; if (rp.n <= 0) jogador.repete = null; }
  }
  jogador.invul = Math.max(0, jogador.invul - dt);
  const sv = stats();
  if (jogador.veneno && !jogador.morto) { // veneno: dano contínuo, ignora invulnerabilidade, não mata sozinho abaixo de 1
    const v = jogador.veneno; v.t -= dt; jogador.vida = Math.max(1, jogador.vida - v.dps * dt);
    v.acum = (v.acum || 0) + v.dps * dt; if (v.acum >= 2) { flutuar(`-${Math.floor(v.acum)}`, jogador.x, jogador.y - 64, "#6bd04a", 10); v.acum -= Math.floor(v.acum); }
    if (v.t <= 0 || mapa.zonaSegura) jogador.veneno = null;
  }
  // recuperação: depois de alguns segundos sem levar dano (e sem veneno) a vida sobe sozinha
  jogador.semDano += dt; jogador.recuperando = false;
  if (!jogador.morto && !jogador.veneno && jogador.semDano >= D.P.regeneracao.espera_s && jogador.vida < sv.vidaMax) {
    jogador.vida = Math.min(sv.vidaMax, jogador.vida + sv.regen * dt); jogador.recuperando = true;
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
      if (antes < h.impacto && jogador.golpe >= h.impacto && h.forma === "escudo") { // Escudo de Gelo: sem dano, protege
        jogador.escudo = { t: h.duracao_efeito, reducao: h.reducao }; efeitoFolha(h, jogador, []); msg(`${h.nome}: −${Math.round(h.reducao * 100)}% de dano`, 1.4);
      } else if (antes < h.impacto && jogador.golpe >= h.impacto) {
        const dano = danoHabilidade(h, D.porGrau, sv.dano, EST.habilidades[h.id] || 1);
        if (h.tiques > 1) zonas.push({ h, o: { x: jogador.x, y: jogador.y, dir: jogador.dir }, n: h.tiques - 1, t: h.intervalo, dano }); // Tornado: a área fica e acerta de novo
        const r = atingir(jogador, monstros, h, dano, sv.critico, sv.criticoMult);
        if (h.efeito) efeitoFolha(h, jogador, r.golpes);
        const efA = efeitosArma(); // clarão no ataque e estouro em quem foi atingido (raridade e reforço da arma)
        if (efA && efA.clarao) jogador.clarao = 0;
        if (efA && efA.impacto) for (const gp of r.golpes) efeitos.push({ tipo: "impacto", x: gp.m.x, y: gp.m.y - 18, t: 0, dur: 0.3, forca: efA.impacto, cor: efA.cor });
        if (h.avanco) { const [vx, vy] = VET[jogador.dir]; for (let k = 0; k < 10; k++) mover(jogador, vx * h.avanco / 10, vy * h.avanco / 10, mapa); }
        if (h.repeticoes > 1) jogador.repete = { h, n: h.repeticoes - 1, t: 0.13 };
        for (const gp of r.golpes) flutuar(gp.crit ? `${Math.round(gp.dano)}!` : `${Math.round(gp.dano)}`, gp.m.x + (Math.random() - 0.5) * 8, gp.m.y - 30 - 18 * gp.m.def.escala, gp.crit ? "#ffd84a" : "#ffffff", gp.crit ? 12 : 9);
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
        const d = danoRecebido(D.P, sv, r.dano, jogador.escudo ? jogador.escudo.reducao : 0); // Defesa do equipamento e Escudo de Gelo
        jogador.vida -= d; jogador.invul = 0.5; jogador.semDano = 0;
        flutuar(`-${d}`, jogador.x + (Math.random() - 0.5) * 10, jogador.y - 64, "#ff6b6b", 11);
        if (r.veneno) { jogador.veneno = { ...r.veneno, t: r.veneno.duracao }; msg("Envenenado!", 1.2); }
        if (jogador.vida <= 0) morrer();
      }
    }
    // itens no chão: somem com o tempo; pega ao passar por cima
    for (let i = chao.length - 1; i >= 0; i--) {
      const c = chao[i]; c.t -= dt;
      if (c.t <= 0) { chao.splice(i, 1); continue; }
      if (Math.hypot(c.x - jogador.x, c.y - jogador.y) < 22) {
        if (pegar(D.itens, EST, c.it)) { precarregar(arquivosDoItem(c.it)); chao.splice(i, 1); msg(`Pegou: ${nomeItem(D.itens, c.it)}`, 2); $("msg").style.color = qualidade(D.itens, c.it.qual).cor; salvar(); }
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
  for (const [bid, hid] of [["bH1", habN(1)], ["bH2", habN(2)], ["bH3", habN(3)], ["bH4", habN(4)]]) {
    const b = $(bid), h = D.hab[hid], cd = jogador.cds[hid] || 0, livre = !!EST.habilidades[hid];
    const txt = !livre ? `Nv ${h.nivel}` : cd > 0 ? cd.toFixed(1) : h.nome;
    if (b.textContent !== txt) b.textContent = txt;
    b.classList.toggle("off", !livre || cd > 0 || mapa.zonaSegura);
  }
  $("hpb").classList.toggle("veneno", !!jogador.veneno); $("hpb").classList.toggle("regen", !!jogador.recuperando);
  $("hpb").firstChild.style.width = Math.max(0, jogador.vida / sv.vidaMax * 100) + "%";
  $("xpb").firstChild.style.width = (EST.nivel >= D.P.nivel_max ? 100 : EST.xp / xpParaProximo(D.P, EST.nivel) * 100) + "%";
  $("info").textContent = `${EST.ouro} ouro · ${EST.pocoes} ${EST.pocoes === 1 ? "poção" : "poções"} · ${EST.fragmentos} frag.`;
}
function morrer() {
  jogador.morto = true; jogador.veneno = null; jogador.golpe = -1; aoMorrer(EST); salvar();
  msg("Você caiu. Voltando à cidade…", 2.6);
  setTimeout(() => {
    const cidade = (regiaoDoMapa(mapa.id) || D.regioes[0]).cidade;
    entrar(cidade, null); jogador.vida = stats().vidaMax; jogador.morto = false; jogador.invul = 1.5;
  }, 1800);
}

// ---------- desenho ----------
// peça de chão por posição (sorteio fixo pelos pesos da base): mesmo mapa, mesmo chão
function pecaBase(b, tx, ty) {
  const total = b.pesos.reduce((s, p) => s + p, 0); let r = ((tx * 73856093) ^ (ty * 19349663)) >>> 0; r %= total;
  for (let i = 0; i < b.pecas.length; i++) { if (r < b.pesos[i]) return b.pecas[i]; r -= b.pesos[i]; }
  return b.pecas[0];
}
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
    if (a.tipo === "investida" || a.tipo === "linha") {
      const L = a.tipo === "linha" ? a.alcance : a.velocidade * a.duracao, w = a.raio * 1.2;
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
// ---------- equipamento em camadas (etapa 12): peças, ordem (zPos) e cores lidas das definições do gerador LPC ----------
// imagens sob demanda (docs/assets/lpc): o que falta é carregado e aparece no quadro seguinte
const IMG_LPC = {}, carregando = new Map();
let refazerPainel = null; // painel aberto com ícones: refeito quando chega imagem nova
function imgLpc(arquivo) {
  const i = IMG_LPC[arquivo]; if (i) return i;
  if (!carregando.has(arquivo)) carregando.set(arquivo, imagem("assets/lpc/" + arquivo).then((im) => { IMG_LPC[arquivo] = im; aoCarregarImagem(); }).catch(() => {}));
  return null;
}
function aoCarregarImagem() { if (refazerPainel) { clearTimeout(aoCarregarImagem.t); aoCarregarImagem.t = setTimeout(() => refazerPainel && $("painel").classList.contains("on") && refazerPainel(), 120); } }
function precarregar(arquivos) { return Promise.all([...new Set(arquivos)].map((a) => { imgLpc(a); return carregando.get(a); })); }
// troca de paleta feita uma vez por imagem+cor e guardada (nunca a cada quadro)
const recoloridas = new CacheRecolor((arquivo, trocas) => {
  const img = IMG_LPC[arquivo], c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); recolorir(d.data, trocas); x.putImageData(d, 0, 0); return c;
});
function folhaDe(l) { const img = imgLpc(l.arquivo); return img ? recoloridas.obter(l.arquivo, l.trocas) || img : null; }
// aparência escolhida -> cores e peças do gerador
function apEq(ap) {
  const a = normalizar(D.AP, ap), d = (c) => opcao(D.AP, a, c)?.def ?? null;
  return { pele: "body." + a.pele, cabelo: "hair." + a.cor_cabelo, olhos: "eye." + a.olhos, defs: { rosto: d("rosto"), cabelo: d("cabelo"), barba: d("barba") } };
}
const equipEq = (equip) => Object.fromEntries(Object.entries(equip).filter(([, it]) => it).map(([e, it]) => [e, { item: it.base, raridade: it.qual, reforco: it.mais || 0 }]));
const cacheCamadas = new Map();
function camadas(anim, equip = EST.equip, classe = EST.classe, ap = EST.aparencia) {
  const k = anim + "|" + classe + "|" + JSON.stringify(equipEq(equip)) + "|" + JSON.stringify(ap);
  let L = cacheCamadas.get(k);
  if (!L) { L = camadasDoPersonagem(D.EQ, classe, equipEq(equip), anim, apEq(ap)); if (cacheCamadas.size > 300) cacheCamadas.clear(); cacheCamadas.set(k, L); }
  return L;
}
// imagens de um item em todas as animações da classe: carregadas antes de vestir (equipar fica instantâneo)
const arquivosDoItem = (it, classe = EST.classe) => (D.itens.animacoes_classe[classe] || []).flatMap((a) => camadasDoItem(D.EQ, it.base, a, it.qual).map((l) => l.arquivo));
function precarregarMochila() { precarregar(EST.mochila.filter((it) => baseItem(D.itens, it.base).formato).flatMap((it) => arquivosDoItem(it))); }
const arquivosDo = (equip, classe, ap) => (D.itens.animacoes_classe[classe] || []).flatMap((a) => camadas(a, equip, classe, ap).map((l) => l.arquivo));
// desenho: quadros de 64, 128 (arco andando) ou 192 px (armas grandes), centrados; contorno da arma por cima
function desenharCamadas(anim, col, linha, ox, oy, alvo = ctx, equip = EST.equip, classe, ap, ef = null, t = 0) {
  for (const l of camadas(anim, equip, classe ?? EST.classe, ap ?? EST.aparencia)) {
    const img = folhaDe(l); if (!img) continue;
    const s = l.tamanho, sx = col * s, sy = linha * s; if (sx >= img.width) continue;
    const dx = ox - (s - 64) / 2, dy = oy - (s - 64) / 2;
    alvo.drawImage(img, sx, sy, s, s, dx, dy, s, s);
    if (ef && ef.contorno && l.encaixe === "arma") {
      alvo.save(); alvo.globalCompositeOperation = "lighter"; alvo.globalAlpha = Math.min(1, ef.contorno * pulso(t, ef.pulsar));
      alvo.drawImage(contornoDe(img, ef.cor), sx, sy, s, s, dx, dy, s, s); alvo.restore();
    }
  }
}
// ícone do item: quadro parado de frente das camadas do item, recortado no que tem pixel e reduzido
const icones = {};
function iconeItem(it) {
  const k = it.base + "|" + it.qual;
  if (icones[k]) return icones[k];
  const L = ordenarPorZ(camadasDoItem(D.EQ, it.base, "walk", it.qual)), imgs = L.map(folhaDe);
  if (imgs.some((i) => !i)) return ""; // ainda carregando: o painel é refeito quando a imagem chegar
  const t = document.createElement("canvas"); t.width = 192; t.height = 192;
  const tx = t.getContext("2d");
  L.forEach((l, i) => { const s = l.tamanho; tx.drawImage(imgs[i], 0, 2 * s, s, s, (192 - s) / 2, (192 - s) / 2, s, s); });
  const px = tx.getImageData(0, 0, 192, 192).data; let x0 = 192, y0 = 192, x1 = 0, y1 = 0;
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) if (px[(y * 192 + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const lado = Math.max(8, x1 - x0 + 1, y1 - y0 + 1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const c = document.createElement("canvas"); c.width = 32; c.height = 32;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(t, Math.round(cx - lado / 2), Math.round(cy - lado / 2), lado, lado, 0, 0, 32, 32);
  return (icones[k] = c.toDataURL());
}
const imgIcone = (it) => `<img class="ic" alt="" src="${iconeItem(it)}">`;

// ---------- efeitos da arma: raridade e reforço (raridades.json); chave no menu para celular fraco ----------
let efeitosLigados = (() => { try { return localStorage.getItem("valdor-efeitos") !== "0"; } catch { return true; } })();
const particulasJogo = new Particulas(24), corDaArma = {};
function efeitosArma() {
  const a = EST.equip.arma; if (!a) return null;
  const R = D.EQ.raridades, e = efeitosDe(R, a.qual, Math.min(a.mais || 0, R.reforco.max), efeitosLigados), k = a.base + "|" + a.qual;
  e.cor = corDaArma[k] ??= raridade(R, a.qual).brilho || corDoItem(camadasDoItem(D.EQ, a.base, "walk", a.qual)[0]?.trocas, "#ffd36a");
  return e;
}
function armaSemEstocar() { const a = EST.equip.arma; return !!(a && estocadaUsaGolpe(D.EQ, a.base)); }
const MAO = { down: [10, -26], up: [-10, -28], left: [-14, -26], right: [14, -26] };
function desenharJogador(t) {
  const g = jogador.golpe, h = jogador.hab, ef = efeitosArma();
  const dir = g >= 0 && h.animacao === "giro" ? ORDEM_GIRO[(ORDEM_GIRO.indexOf(jogador.dir) + Math.floor(g / h.duracao * 4)) % 4] : jogador.dir;
  const L = LINHA[dir], ox = Math.round(jogador.x - 32 - cam.x), oy = Math.round(jogador.y - 60 - cam.y);
  ctx.fillStyle = "#0005"; ctx.beginPath(); ctx.ellipse(Math.round(jogador.x - cam.x), Math.round(jogador.y - 1 - cam.y), 12, 4, 0, 0, 7); ctx.fill(); // sombra
  desenharAura(t);
  if (ef) desenharAuraEf(ctx, Math.round(jogador.x - cam.x), Math.round(jogador.y - 2 - cam.y), ef.aura, ef.cor, t);
  if (jogador.invul > 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.5;
  const C = (anim, q) => desenharCamadas(anim, q, L, ox, oy, ctx, EST.equip, undefined, undefined, ef, t);
  if (g >= 0 && h.animacao === "shoot") C("shoot", Math.min(12, Math.floor(g / Math.min(h.duracao, 0.55) * 13)));
  else if (g >= 0 && h.animacao === "thrust" && !armaSemEstocar()) C("thrust", Math.min(7, Math.floor(g / h.duracao * 8)));
  else if (g >= 0 && h.animacao === "thrust") C("slash", Math.min(5, Math.floor(g / h.duracao * 6))); // improviso: arma sem estocar
  else if (g >= 0) { // golpe e giro usam a animação de golpear; o giro troca de direção 4 vezes
    const passo = h.animacao === "giro" ? h.duracao / 4 : h.duracao;
    C("slash", Math.min(5, Math.floor((g % passo) / passo * 6)));
    if (h.animacao === "giro") { ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = "#dfefff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(jogador.x - cam.x, jogador.y - 14 - cam.y, h.raio, h.raio * 0.7, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  } else C("walk", jogador.andando ? 1 + Math.floor(jogador.tAnim * 10) % 8 : 0);
  ctx.globalAlpha = 1;
  if (g >= 0 && (h.animacao === "slash" || h.animacao === "giro" || (h.animacao === "thrust" && armaSemEstocar()))) desenharRastro(dir, g, h, ef);
  if (!ef) return;
  const [mx, my] = MAO[dir], hx = jogador.x + mx, hy = jogador.y + my;
  if (ef.qtdParticulas && particulasJogo.quantidade < ef.qtdParticulas && Math.random() < 0.35) particulasJogo.emitir(hx, hy, ef.cor, 1, { espalha: 14, velocidade: 5, sobe: 9, vida: 0.9, tam: 1 });
  ctx.save(); ctx.translate(-cam.x, -cam.y); particulasJogo.desenhar(ctx); ctx.restore();
  if (jogador.clarao >= 0) desenharClarao(ctx, hx - cam.x, hy - cam.y, ef.clarao, jogador.clarao / 0.2, ef.cor);
}
// aura nos pés de conjunto completo (cor do conjunto); a aura da raridade e do reforço vem dos efeitos da arma
function desenharAura(t) {
  const x = jogador.x - cam.x, y = jogador.y - 2 - cam.y, p = 0.5 + 0.5 * Math.sin(t * 3);
  const completo = conjuntosAtivos(D.itens, EST.equip).find((c) => c.completo);
  if (!completo) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = completo.conjunto.cor; ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35 + 0.3 * p; ctx.beginPath(); ctx.ellipse(x, y, 18 + 3 * p, 7 + p, 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = 0.15 + 0.1 * p; ctx.fillStyle = completo.conjunto.cor; ctx.fill(); ctx.restore();
}
// rastro da arma ao golpear: cor e força pelos efeitos da arma (sem efeitos: um arco branco fraco, para ver o golpe)
const ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
function desenharRastro(dir, g, h, ef) {
  if (!EST.equip.arma) return;
  const passo = h.animacao === "giro" ? h.duracao / 4 : h.duracao, f = (g % passo) / passo, forca = ef ? Math.max(ef.rastro, ef.contorno * 0.6) : 0;
  const a0 = ANG[dir] - 1.2, a = a0 + 2.4 * Math.min(1, f * 1.4);
  ctx.save(); if (forca) ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = forca ? ef.cor : "#ffffff"; ctx.globalAlpha = (0.25 + 0.6 * forca) * (1 - f * 0.6);
  ctx.lineWidth = 2 + 3 * forca; ctx.beginPath(); ctx.arc(jogador.x - cam.x, jogador.y - 22 - cam.y, 24, a0, a); ctx.stroke(); ctx.restore();
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
    const b = D.CEN.bases[mapa.base] || D.CEN.bases.grama, [cx, cy] = pecaBase(b, tx, ty);
    ctx.drawImage(IMG[b.img], cx * 32, cy * 32, 32, 32, px, py, 32, 32);
    if (tx === 0 || ty === 0 || tx === mapa.w - 1 || ty === mapa.h - 1) if (bloqueadoTile(mapa, tx, ty)) { ctx.fillStyle = b.borda || "#0b2410"; ctx.fillRect(px, py, 32, 32); }
  }
  const fila = [];
  for (const o of mapa.objetos) fila.push({ y: (o.y + o.h) * TILE, f: () => {
    const px = o.x * TILE - cam.x, py = o.y * TILE - cam.y;
    if (o.tipo === "arvore") { const lista = D.CEN.obstaculos[o.estilo || "arvore"], sp = lista[(o.v || 0) % lista.length]; // em pé, base no chão da pegada 2x2
      ctx.drawImage(IMG[sp.img], sp.x, sp.y, sp.w, sp.h, px + 32 - sp.w / 2, py + 64 - sp.h, sp.w, sp.h); }
    else if (o.tipo === "lagoa") { const sp = D.CEN.lagoas[mapa.base] || D.CEN.lagoas.grama; ctx.drawImage(IMG[sp.img], sp.x, sp.y, sp.w, sp.h, px, py + 96 - sp.h, sp.w, sp.h); }
    else if (o.nome && IMG["cidade/" + o.nome]) { const im = IMG["cidade/" + o.nome]; ctx.drawImage(im, px, py + o.h * TILE - im.height); }
    else ctx.drawImage(IMG.house, 0, 0, 192, 160, px, py, 192, 160);
  } });
  for (const n of mapa.npcs) fila.push({ y: n.y * TILE + 28, f: () => {
    const px = n.x * TILE - cam.x, py = n.y * TILE - cam.y;
    if (n.tipo === "quadro") { etiqueta(NOMES[n.tipo], px + 16, py - 98); return; } // o quadro é a construção logo acima
    const sp = n.tipo === "mercador" ? IMG.princess : IMG.soldier_altcolor;
    ctx.drawImage(sp, 0, 2 * 64, 64, 64, px - 16, py - 32, 64, 64); etiqueta(NOMES[n.tipo], px + 16, py - 28);
  } });
  for (const p of mapa.portais) fila.push({ y: p.y * TILE + 28, f: () => {
    const px = p.x * TILE + 16 - cam.x, py = p.y * TILE + 16 - cam.y, dest = D.regioes.find((r) => r.id === p.para), aberto = EST.nivel >= dest.niveis[0];
    ctx.fillStyle = aberto ? "#6fd0ff" : "#555a66"; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); ctx.beginPath(); ctx.ellipse(px, py, 14, 22, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = aberto ? "#bfeaff" : "#868c99"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py, 14, 22, 0, 0, 7); ctx.stroke();
    etiqueta(`${dest.nome}${aberto ? "" : ` (nv ${dest.niveis[0]})`}`, px, py - 28);
  } });
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
    ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2); ctx.font = `bold ${f.tam}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#000b"; ctx.fillText(f.txt, f.x - cam.x + 1, f.y - cam.y + 1); ctx.fillStyle = f.cor; ctx.fillText(f.txt, f.x - cam.x, f.y - cam.y); ctx.restore(); }
}

let antes = 0, acum = 0;
function quadro(agora) {
  const dt = Math.min(0.1, (agora - antes) / 1000 || 0); antes = agora; acum += dt;
  while (acum >= 1 / 60) { atualizar(1 / 60); acum -= 1 / 60; }
  desenhar(agora / 1000);
  requestAnimationFrame(quadro);
}
window.__valdor = { get chao() { return chao; }, efeitos: () => efeitos, get est() { return EST; }, get mapa() { return mapa; }, get jogador() { return jogador; }, get monstros() { return monstros; }, entrar, atacar, interagir, usarHabilidade,
  ganhar: (xp) => { subiuNiveis(ganharXp(D.P, EST, xp)); salvar(); } }; // ganchos para os testes de navegador
iniciar().catch((e) => { document.body.insertAdjacentHTML("beforeend", `<pre style="position:fixed;inset:0;background:#300;padding:12px;z-index:20;white-space:pre-wrap">Erro ao iniciar: ${String(e.message).replace(/</g, "&lt;")}</pre>`); console.error(e); });
