import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Tipos ──────────────────────────────────────────────────

export type Lista = {
  id: string;
  nome: string;
  origem: string;
  total_contatos: number;
  contactados: number;
  criada_em: string;
};

export type Contato = {
  id: string;
  lista_id: string;
  nome: string | null;
  telefone: string;
  ddd: string | null;
  estado: string | null;
  empresa: string | null;
  extra: Record<string, unknown>;
  valido_whatsapp: boolean | null;
  ja_contactado: boolean;
  criado_em: string;
};

export type Template = {
  id: string;
  nome: string;
  corpo: string;
  ativo: boolean;
  taxa_resposta: number | null;
  criado_em: string;
};

export type Campanha = {
  id: string;
  nome: string;
  lista_id: string;
  template_id: string | null;
  status: 'rascunho' | 'rodando' | 'pausada' | 'concluida' | 'cancelada';
  total_planejado: number;
  total_enviado: number;
  total_falhou: number;
  total_respondeu: number;
  criada_em: string;
  // da view
  lista_nome?: string;
  template_nome?: string;
  taxa_resposta?: number;
};

export type Lead = {
  lead_id: string;
  nome: string;
  status: string;
  temperatura: string;
  score: number;
  etapa_funil: string;
  status_bot: string;
  responsavel_humano: string | null;
  dor_principal: string | null;
  ultima_interacao: string;
};

export type BaseConhecimento = {
  id: string;
  versao: number;
  conteudo: string;
  ativa: boolean;
  criada_em: string;
};