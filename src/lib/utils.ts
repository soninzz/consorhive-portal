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
 * Interpola variáveis no template de mensagem
 * Ex: "Oi {{nome}}!" com { nome: "João" } → "Oi João!"
 */
export function interpolarTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
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
    case 'quente': return 'text-red-400';
    case 'morno': return 'text-yellow-400';
    case 'frio': return 'text-blue-400';
    default: return 'text-slate-400';
  }
}

export function bgTemperatura(temperatura: string): string {
  switch (temperatura) {
    case 'quente': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'morno': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'frio': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default: return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

export function corStatus(status: string): string {
  switch (status) {
    case 'rodando': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'pausada': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'concluida': return 'bg-slate-700 text-slate-300 border-slate-600';
    case 'cancelada': return 'bg-red-500/10 text-red-400 border-red-500/20';
    default: return 'bg-slate-800 text-slate-400 border-slate-700'; // rascunho
  }
}