export function normalizarTelefone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (!digits.startsWith('55')) digits = '55' + digits;
  if (digits.length < 12 || digits.length > 13) return null;
  return '+' + digits;
}

export function extrairDDD(telefoneE164: string): string | null {
  const digits = telefoneE164.replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(2, 4);
  return null;
}

export function interpolarTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '{{' + key + '}}');
}

export function formatarData(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function tempoRelativo(iso: string): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return String(Math.floor(diff / 60)) + 'min';
  if (diff < 86400) return String(Math.floor(diff / 3600)) + 'h';
  return String(Math.floor(diff / 86400)) + 'd';
}

export function bgTemperatura(t: string): string {
  switch (t) {
    case 'quente': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'morno': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  }
}

export function corStatus(status: string): string {
  switch (status) {
    case 'rodando': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'pausada': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'concluida': return 'bg-slate-700 text-slate-300 border-slate-600';
    case 'cancelada': return 'bg-red-500/10 text-red-400 border-red-500/20';
    default: return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}
