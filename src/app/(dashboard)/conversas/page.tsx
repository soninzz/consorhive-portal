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
};

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
    case 'quente': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'morno': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
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
      <div className="w-80 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-50 font-semibold flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-500" />
              Conversas
            </h2>
            <button onClick={carregar} className="text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-slate-200 text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-1">
            {(['todos', 'ativo', 'pausado'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroBot(f)}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                  filtroBot === f ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'ativo' ? '🤖 Bianca' : '👤 Humano'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-slate-500 text-xs p-4">Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-slate-500 text-xs p-4">Nenhuma conversa encontrada.</p>
          ) : (
            filtrados.map(lead => (
              <button
                key={lead.lead_id}
                onClick={() => setLeadSelecionado(lead)}
                className={`w-full text-left p-4 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
                  leadSelecionado?.lead_id === lead.lead_id ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-slate-200 text-sm font-medium truncate">{lead.nome || lead.lead_id}</p>
                  <span className="text-slate-600 text-xs shrink-0">{tempoRelativo(lead.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${corTemperatura(lead.temperatura)}`}>
                    {lead.temperatura || 'frio'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    lead.status_bot === 'ativo'
                      ? 'bg-emerald-900/30 text-emerald-400'
                      : 'bg-orange-900/30 text-orange-400'
                  }`}>
                    {lead.status_bot === 'ativo' ? 'Bianca' : 'Humano'}
                  </span>
                  <span className="text-slate-600 text-xs">score {lead.score ?? 0}</span>
                </div>
                {lead.historico_conversa?.length > 0 && (
                  <p className="text-slate-600 text-xs mt-1.5 truncate">
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
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-slate-50 font-semibold">{leadSelecionado.nome || leadSelecionado.lead_id}</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {leadSelecionado.lead_id} · Score {leadSelecionado.score ?? 0} ·{' '}
                <span className={leadSelecionado.status_bot === 'ativo' ? 'text-emerald-400' : 'text-orange-400'}>
                  {leadSelecionado.status_bot === 'ativo' ? 'Bianca respondendo' : 'Consultor responsável'}
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
                  Devolver para Bianca
                </button>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-3">
            {(!leadSelecionado.historico_conversa || leadSelecionado.historico_conversa.length === 0) ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-600 text-sm">Nenhuma mensagem ainda.</p>
              </div>
            ) : (
              leadSelecionado.historico_conversa.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'assistant' ? 'bg-emerald-900' : 'bg-slate-700'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot size={14} className="text-emerald-400" />
                      : <User size={14} className="text-slate-400" />
                    }
                  </div>
                  <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'assistant'
                      ? 'bg-slate-800 text-slate-200'
                      : 'bg-emerald-900/20 border border-emerald-800/30 text-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé info */}
          <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-900/50 flex items-center gap-6 text-xs text-slate-500 flex-shrink-0">
            <span>Temperatura: <strong className="text-slate-300 capitalize">{leadSelecionado.temperatura || '—'}</strong></span>
            <span>Status: <strong className="text-slate-300">{leadSelecionado.status || '—'}</strong></span>
            {leadSelecionado.dor_principal && (
              <span>Dor: <strong className="text-slate-300">{leadSelecionado.dor_principal}</strong></span>
            )}
            <span>Mensagens: <strong className="text-slate-300">{leadSelecionado.historico_conversa?.length ?? 0}</strong></span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Selecione uma conversa para visualizar</p>
          </div>
        </div>
      )}
    </div>
  );
}