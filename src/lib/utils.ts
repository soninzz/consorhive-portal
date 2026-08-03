import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizarTelefone(raw: string): string | null {
  // Remove tudo que não é dígito
  let digits = raw.replace(/\D/g, '');

  // Remove zeros à esquerda
  digits = digits.replace(/^0+/, '');

  // Adiciona DDI 55 se não tiver
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }

  // Valida tamanho: 55 + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos
  if (digits.length < 12 || digits.length > 13) {
    return null;
  }

  return '+' + digits;
}

/**
 * Extrai DDD do telefone E.164 brasileiro
 */
export function extrairDDD(telefoneE164: string): string | null {
  const digits = telefoneE164.replace(/\D/g, '');
  if (digits.length >= 4) {
    return digits.slice(2, 4); // remove 55, pega 2 próximos
  }
  return null;
}

/**
 * Resolve blocos de variação (spintax) no template, sorteando uma opção por bloco.
 * Ex: "Oi{de boa|tudo bem|beleza}!" → sorteia uma das 3 opções.
 * Blocos sem "|" (como o {nome} interno de {{nome}}) são ignorados, então não
 * conflita com a interpolação de variáveis.
 */
export function resolverSpintax(texto: string): string {
  return texto.replace(/\{([^{}]+)\}/g, (match, conteudo: string) => {
    if (!conteudo.includes('|')) return match;
    const opcoes = conteudo.split('|').map(o => o.trim());
    return opcoes[Math.floor(Math.random() * opcoes.length)];
  });
}

/**
 * Conta quantas combinações distintas um template consegue gerar a partir
 * dos blocos de variação — usado pra avisar quando a lista é maior que o
 * repertório de variações do template (risco de repetir mensagem).
 */
export function contarCombinacoesSpintax(texto: string): number {
  const blocos = texto.match(/\{([^{}]+)\}/g) ?? [];
  let total = 1;
  for (const bloco of blocos) {
    const conteudo = bloco.slice(1, -1);
    if (!conteudo.includes('|')) continue;
    total *= conteudo.split('|').length;
  }
  return total;
}

/**
 * Interpola variáveis no template de mensagem, resolvendo antes as variações (spintax)
 * Ex: "Oi {{nome}}!" com { nome: "João" } → "Oi João!"
 */
export function interpolarTemplate(template: string, vars: Record<string, string>): string {
  const comVariacoes = resolverSpintax(template);
  return comVariacoes.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Gera uma mensagem a partir do template garantindo que o texto final ainda não
 * foi usado (evita mandar a mesma mensagem, mesmo por sorte do spintax, pra dois
 * números diferentes). Sorteia até `maxTentativas` vezes; se não achar variação
 * inédita, retorna null — quem chamar decide como avisar o usuário.
 */
export function gerarMensagemUnica(
  corpo: string,
  vars: Record<string, string>,
  usadas: Set<string>,
  maxTentativas = 50
): string | null {
  for (let i = 0; i < maxTentativas; i++) {
    const mensagem = interpolarTemplate(corpo, vars);
    if (!usadas.has(mensagem)) {
      usadas.add(mensagem);
      return mensagem;
    }
  }
  return null;
}

/**
 * Extrai o primeiro nome de um nome completo
 */
export function primeiroNome(nomeCompleto: string | null | undefined): string | null {
  if (!nomeCompleto?.trim()) return null;
  return nomeCompleto.trim().split(/\s+/)[0];
}

/**
 * Formata data para exibição em pt-BR
 */
export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Cor da temperatura para UI
 */
export function corTemperatura(temperatura: string): string {
  switch (temperatura) {
    case 'quente': return 'text-red-600';
    case 'morno': return 'text-yellow-700';
    case 'frio': return 'text-blue-600';
    default: return 'text-slate-400';
  }
}

export function bgTemperatura(temperatura: string): string {
  switch (temperatura) {
    case 'quente': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'morno': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    case 'frio': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default: return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

export function corStatus(status: string): string {
  switch (status) {
    case 'rodando': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'pausada': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    case 'concluida': return 'bg-slate-700 text-slate-300 border-slate-600';
    case 'cancelada': return 'bg-red-500/10 text-red-600 border-red-500/20';
    default: return 'bg-slate-800 text-slate-400 border-slate-700'; // rascunho
  }
}