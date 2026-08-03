'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Search, User, Bot, RefreshCw, UserCheck } from 'lucide-react';

type Lead = {
  lead_id: string;
  nome: string;
  status: string;
  temperatura: string;
  score: number;
  status_bot: string;
  historico_conversa: Array<{ role: string; content: string }>;
  updated_at: string;
  dor_principal: string | null;
  follow_up_em: string | null;
  follow_up_nota: string | null;
};

function formatarDataCurta(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tempoRelativo(iso: string) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function corTemperatura(t: string) {
  switch (t) {
    case 'quente': return 'text-red-600 bg-red-500/10 border-red-500/20';
    case 'morno': return 'text-yellow-700 bg-yellow-500/10 border-yellow-500/20';
    default: return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
  }
}

export default function ConversasPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroBot, setFiltroBot] = useState<'todos' | 'ativo' | 'pausado'>('todos');
  const [loading, setLoading] = useState(true);
  const [agindo, setAgindo] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { carregar(); }, [filtroBot]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [leadSelecionado]);

  async function carregar() {
    setLoading(true);
    let query = supabase
      .from('leads_qualificacao')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (filtroBot === 'ativo') query = query.eq('status_bot', 'ativo');
    if (filtroBot === 'pausado') query = query.eq('status_bot', 'pausado_humano');

    const { data } = await query;
    setLeads(data ?? []);
    setLoading(false);
  }

  async function assumir(lead: Lead) {
    setAgindo(true);
    await supabase
      .from('leads_qualificacao')
      .update({ status_bot: 'pausado_humano', responsavel_humano: 'Consultor' })
      .eq('lead_id', lead.lead_id);
    await carregar();
    setLeadSelecionado(prev => prev?.lead_id === lead.lead_id ? { ...prev, status_bot: 'pausado_humano' } : prev);
    setAgindo(false);
  }

  async function devolver(lead: Lead) {
    setAgindo(true);
    await supabase
      .from('leads_qualificacao')
      .update({ status_bot: 'ativo', responsavel_humano: null })
      .eq('lead_id', lead.lead_id);
    await carregar();
    setLeadSelecionado(prev => prev?.lead_id === lead.lead_id ? { ...prev, status_bot: 'ativo' } : prev);
    setAgindo(false);
  }

  const filtrados = leads.filter(l =>
    l.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    l.lead_id?.includes(busca)
  );

  return (
    <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh)' }}>
      {/* Sidebar lista */}
      <div className="w-80 border-r border-border flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-semibold flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-600" />
              Conversas
            </h2>
            <button onClick={carregar} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full bg-muted border border-border rounded-lg pl-8 pr-3 py-2 text-foreground text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-1">
            {(['todos', 'ativo', 'pausado'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroBot(f)}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                  filtroBot === f ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'ativo' ? '🤖 Automático' : '👤 Humano'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground text-xs p-4">Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-muted-foreground text-xs p-4">Nenhuma conversa encontrada.</p>
          ) : (
            filtrados.map(lead => (
              <button
                key={lead.lead_id}
                onClick={() => setLeadSelecionado(lead)}
                className={`w-full text-left p-4 border-b border-border/60 hover:bg-muted/50 transition-colors ${
                  leadSelecionado?.lead_id === lead.lead_id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-foreground text-sm font-medium truncate">{lead.nome || lead.lead_id}</p>
                  <span className="text-muted-foreground text-xs shrink-0">{tempoRelativo(lead.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${corTemperatura(lead.temperatura)}`}>
                    {lead.temperatura || 'frio'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    lead.status_bot === 'ativo'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {lead.status_bot === 'ativo' ? 'Automático' : 'Humano'}
                  </span>
                  <span className="text-muted-foreground text-xs">score {lead.score ?? 0}</span>
                  {lead.follow_up_em && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      📅 {formatarDataCurta(lead.follow_up_em)}
                    </span>
                  )}
                </div>
                {lead.historico_conversa?.length > 0 && (
                  <p className="text-muted-foreground text-xs mt-1.5 truncate">
                    {lead.historico_conversa[lead.historico_conversa.length - 1]?.content?.slice(0, 55)}...
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Área de chat */}
      {leadSelecionado ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-foreground font-semibold">{leadSelecionado.nome || leadSelecionado.lead_id}</h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                {leadSelecionado.lead_id} · Score {leadSelecionado.score ?? 0} ·{' '}
                <span className={leadSelecionado.status_bot === 'ativo' ? 'text-emerald-600' : 'text-orange-600'}>
                  {leadSelecionado.status_bot === 'ativo' ? 'Automático respondendo' : 'Consultor responsável'}
                </span>
              </p>
            </div>
            <div>
              {leadSelecionado.status_bot === 'ativo' ? (
                <button
                  onClick={() => assumir(leadSelecionado)}
                  disabled={agindo}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  <UserCheck size={13} />
                  Assumir conversa
                </button>
              ) : (
                <button
                  onClick={() => devolver(leadSelecionado)}
                  disabled={agindo}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  <Bot size={13} />
                  Devolver para o Maikon
                </button>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-3">
            {(!leadSelecionado.historico_conversa || leadSelecionado.historico_conversa.length === 0) ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
              </div>
            ) : (
              leadSelecionado.historico_conversa.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'assistant' ? 'bg-emerald-100' : 'bg-muted'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot size={14} className="text-emerald-600" />
                      : <User size={14} className="text-muted-foreground" />
                    }
                  </div>
                  <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'assistant'
                      ? 'bg-muted text-foreground'
                      : 'bg-emerald-50 border border-emerald-200 text-foreground'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé info */}
          <div className="px-6 py-2.5 border-t border-border bg-muted/60 flex items-center gap-6 text-xs text-muted-foreground flex-shrink-0">
            <span>Temperatura: <strong className="text-foreground capitalize">{leadSelecionado.temperatura || '—'}</strong></span>
            <span>Status: <strong className="text-foreground">{leadSelecionado.status || '—'}</strong></span>
            {leadSelecionado.dor_principal && (
              <span>Dor: <strong className="text-foreground">{leadSelecionado.dor_principal}</strong></span>
            )}
            <span>Mensagens: <strong className="text-foreground">{leadSelecionado.historico_conversa?.length ?? 0}</strong></span>
            {leadSelecionado.follow_up_em && (
              <span className="flex items-center gap-1 text-primary">
                📅 Follow-up: <strong>{formatarDataCurta(leadSelecionado.follow_up_em)}</strong>
                {leadSelecionado.follow_up_nota && <span className="text-muted-foreground">({leadSelecionado.follow_up_nota})</span>}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Selecione uma conversa para visualizar</p>
          </div>
        </div>
      )}
    </div>
  );
}