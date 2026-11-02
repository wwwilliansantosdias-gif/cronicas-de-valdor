// Save versionado. Cada versão nova traz uma migração da anterior: progresso nunca é apagado por atualização.
import { atributosIniciais, pontosAteNivel, pontosHabilidadeAteNivel, equipamentoInicial } from "./personagem.js";

const CHAVE = "valdor-save";
export const VERSAO = 2;

export function serializar(est) { return JSON.stringify(est); }

function inteiro(v, min, max) { return Number.isInteger(v) && v >= min && v <= max; }

// v1 (etapa 6 inicial) -> v2: pontos acumulados até o nível ficam livres e são distribuídos no modo recomendado;
// o "afiar" antigo (armaNivel) vira o +N da espada; armadura inicial vira itens comuns.
export function migrarV1(P, I, v1) {
  const est = { ...v1, versao: 2, atributos: atributosIniciais(P), pontosLivres: pontosAteNivel(P, v1.nivel), autoDistribuir: true,
    habilidades: { golpe: 1 }, pontosHab: pontosHabilidadeAteNivel(P, v1.nivel), equip: equipamentoInicial(I, v1.classe), mochila: [], fragmentos: 0 };
  est.equip.arma.mais = Math.min(I.melhoria.max, v1.armaNivel || 0);
  delete est.armaNivel;
  return est;
}

function itemValido(I, it, espaco) {
  if (!it || typeof it !== "object") return false;
  const b = I.itens.find((x) => x.id === it.base);
  return !!b && (!espaco || b.espaco === espaco) && I.qualidades.some((q) => q.id === it.qual) && inteiro(it.mais, 0, I.melhoria.max)
    && it.bonus && typeof it.bonus === "object";
}

// devolve o estado (migrado, se preciso) ou null se ausente/corrompido
export function validar(P, I, obj, mapasValidos) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.versao === 1) {
    if (!inteiro(obj.nivel, 1, P.nivel_max) || !inteiro(obj.armaNivel ?? 0, 0, 9)) return null;
    obj = migrarV1(P, I, obj);
  }
  if (obj.versao !== VERSAO || obj.classe !== "guerreiro") return null;
  if (!inteiro(obj.nivel, 1, P.nivel_max) || !inteiro(obj.ouro, 0, 1e9) || !inteiro(obj.pocoes, 0, 999)) return null;
  if (typeof obj.xp !== "number" || !(obj.xp >= 0)) return null;
  if (!mapasValidos.includes(obj.mapa)) return null;
  if (!obj.missoes || typeof obj.missoes !== "object") return null;
  if (!obj.atributos || !P.atributos.every((a) => inteiro(obj.atributos[a], P.atributo_inicial, 999))) return null;
  if (!inteiro(obj.pontosLivres, 0, 999) || !inteiro(obj.pontosHab, 0, 99) || !inteiro(obj.fragmentos, 0, 1e6)) return null;
  const gastos = P.atributos.reduce((s, a) => s + obj.atributos[a] - P.atributo_inicial, 0);
  if (gastos + obj.pontosLivres !== pontosAteNivel(P, obj.nivel)) return null; // pontos não podem aparecer do nada
  if (!obj.equip || !I.espacos.every((e) => obj.equip[e] === null || itemValido(I, obj.equip[e], e))) return null;
  if (!Array.isArray(obj.mochila) || obj.mochila.length > 20 || !obj.mochila.every((it) => itemValido(I, it))) return null;
  if (!obj.habilidades || typeof obj.habilidades !== "object") return null;
  return obj;
}

export function carregar(P, I, storage, mapasValidos) {
  try {
    const bruto = storage.getItem(CHAVE);
    return bruto ? validar(P, I, JSON.parse(bruto), mapasValidos) : null;
  } catch { return null; }
}

export function guardar(storage, est) {
  try { storage.setItem(CHAVE, serializar(est)); return true; } catch { return false; }
}

export function apagar(storage) { try { storage.removeItem(CHAVE); } catch { /* sem armazenamento */ } }
