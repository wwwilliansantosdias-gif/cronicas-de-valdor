// Aparência do herói (dados/aparencia.json): rosto, cabelo e barba são peças do gerador LPC; pele, cor do cabelo
// e olhos são trocas de paleta, como o gerador faz: cada cor da paleta-base vira a cor de mesma posição na escolhida.
export const CAMPOS = ["pele", "rosto", "cabelo", "cor_cabelo", "barba", "olhos"];
export const NOMES_CAMPO = { pele: "Pele", rosto: "Rosto", cabelo: "Cabelo", cor_cabelo: "Cor do cabelo", barba: "Barba", olhos: "Olhos" };

export function opcoes(AP, campo) { return Array.isArray(AP[campo]) ? AP[campo] : AP[campo].opcoes; }
export function opcao(AP, a, campo) { return opcoes(AP, campo).find((o) => o.id === a[campo]); }

// completa campos ausentes e troca ids desconhecidos pelo padrão (save antigo ou adulterado nunca quebra o desenho)
export function normalizar(AP, a) {
  const out = {};
  for (const c of CAMPOS) out[c] = a && typeof a === "object" && opcoes(AP, c).some((o) => o.id === a[c]) ? a[c] : AP.padrao[c];
  return out;
}

// próxima (passo 1) ou anterior (passo -1) opção de um campo, dando a volta
export function alternar(AP, a, campo, passo) {
  const ops = opcoes(AP, campo), i = ops.findIndex((o) => o.id === a[campo]);
  return { ...a, [campo]: ops[(i + passo + ops.length) % ops.length].id };
}

export function aleatoria(AP, rng = Math.random) {
  const a = {};
  for (const c of CAMPOS) { const ops = opcoes(AP, c); a[c] = ops[Math.floor(rng() * ops.length)].id; }
  return a;
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// pares [de, para] em RGB para uma paleta escolhida; vazio quando é a própria base
export function pares(AP, campo, id) {
  const p = AP[campo], o = p.opcoes.find((x) => x.id === id);
  if (!o || id === p.base) return [];
  return p.base_cores.map((c, i) => [rgb(c), rgb(o.cores[i])]);
}

// troca as cores no lugar (RGBA), com tolerância de ±1 por canal como no gerador
export function recolorir(px, trocas, tol = 1) {
  if (!trocas.length) return px;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    for (const [de, para] of trocas) {
      if (Math.abs(px[i] - de[0]) <= tol && Math.abs(px[i + 1] - de[1]) <= tol && Math.abs(px[i + 2] - de[2]) <= tol) {
        px[i] = para[0]; px[i + 1] = para[1]; px[i + 2] = para[2]; break;
      }
    }
  }
  return px;
}
