const CHAVE = "valdor-save";

export function serializar(est) { return JSON.stringify(est); }

function inteiro(v, min, max) { return Number.isInteger(v) && v >= min && v <= max; }

// devolve o estado, ou null se não houver save ou estiver corrompido
export function validar(obj, mapasValidos) {
  if (!obj || typeof obj !== "object" || obj.versao !== 1) return null;
  if (obj.classe !== "guerreiro") return null;
  if (!inteiro(obj.nivel, 1, 29) || !inteiro(obj.ouro, 0, 1e9) || !inteiro(obj.pocoes, 0, 999) || !inteiro(obj.armaNivel, 0, 3)) return null;
  if (typeof obj.xp !== "number" || !(obj.xp >= 0)) return null;
  if (!mapasValidos.includes(obj.mapa)) return null;
  if (!obj.missoes || typeof obj.missoes !== "object") return null;
  return obj;
}

export function carregar(storage, mapasValidos) {
  try {
    const bruto = storage.getItem(CHAVE);
    return bruto ? validar(JSON.parse(bruto), mapasValidos) : null;
  } catch { return null; }
}

export function guardar(storage, est) {
  try { storage.setItem(CHAVE, serializar(est)); return true; } catch { return false; }
}

export function apagar(storage) { try { storage.removeItem(CHAVE); } catch { /* sem armazenamento */ } }
