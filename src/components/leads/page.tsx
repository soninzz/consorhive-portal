'use client';

import { useState, useEffect } from 'react';
import { supabase, type Lead } from '@/lib/supabase';
import { bgTemperatura, formatarData } from '@/lib/utils-consorhive';
import { Users, Search, MessageSquare, UserCheck, BotOff } from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTemperatura, setFiltroTemperatura] = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('v_leads_dashboard')
      .select('*')
      .order('ultima_interacao', { ascending: false })
      .limit(200);
    setLeads(data ?? []);
    setLoading(false);
  }

  async function assumir(telefone: string) {
    await supabase
      .from('leads_qualificacao')
      .update({ status_bot: 'pausado', responsavel_humano: 'Maikon' })
      .eq('lead_id', telefone);
    carregar();
  }

  async function reativar(telefone: string) {
    await supabase
      .from('leads_qualificacao')
      .update({ status_bot: 'ativo', responsavel_humano: null })
      .eq('lead_id', telefone);
    carregar();
  }

  const filtrados = leads.filter(l => {
    const buscaOk = !busca || l.nome?.toLowerCase().includes(busca.toLowerCase()) || l.lead_id.includes(busca);
    const statusOk = !filtroStatus || l.status === filtroStatus;
    const tempOk = !filtroTemperatura || l.temperatura === filtroTemperatura;
    return buscaOk && statusOk && tempOk;
  });

  const labelEtapa: Record<string, string> = {
    LEAD: 'Lead',
    EM_CONVERSA: 'Em conversa',
    QUALIFICANDO: 'Qualificando',
    REUNIAO: 'Reunião',
    VENDA: 'Venda',
    PERDIDO: 'Perdido',
  };

  return (
    <div className="flex-1 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Leads</h2>
          <p className="text-slate-400 text-sm mt-1">Todos os contatos que interagiram com a Bianca.</p>
        </div>
        <button onClick={carregar} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 w-64"
          />
        </div>
        <select
          value={filtroTemperatura}
          onChange={e => setFiltroTemperatura(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todas temperaturas</option>
          <option value="quente">🔥 Quente</option>
          <option value="morno">🌡 Morno</option>
          <option value="frio">🧊 Frio</option>
        </select>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos os status</option>
          <option value="qualificando">Qualificando</option>
          <option value="handoff">Handoff</option>
          <option value="pausado">Pausado</option>
        </select>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando leads...</div>
      ) : filtrados.length === 0 ? (
        <div className="border border-dashed border-slate-700 rounded-xl p-16 text-center">
          <Users size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Nenhum lead ainda</p>
          <p className="text-slate-600 text-sm mt-1">Quando a Bianca iniciar uma campanha, os leads aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-800 text-xs text-slate-500">
            {filtrados.length} lead{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Nome / Telefone</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Temperatura</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Etapa</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Dor principal</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Última interação</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Bot</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((lead) => (
                <tr key={lead.lead_id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-slate-200 font-medium">{lead.nome || '—'}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{lead.lead_id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full border capitalize ${bgTemperatura(lead.temperatura)}`}>
                      {lead.temperatura}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {labelEtapa[lead.etapa_funil] ?? lead.etapa_funil}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs max-w-[200px] truncate">
                    {lead.dor_principal ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {lead.ultima_interacao ? formatarData(lead.ultima_interacao) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      lead.status_bot === 'ativo'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {lead.status_bot === 'ativo' ? 'Ativa' : 'Pausada'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      {lead.status_bot === 'ativo' ? (
                        <button
                          onClick={() => assumir(lead.lead_id)}
                          title="Assumir conversa (pausa a Bianca)"
                          className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors px-2 py-1 rounded border border-yellow-500/20 hover:border-yellow-500/40"
                        >
                          <UserCheck size={12} /> Assumir
                        </button>
                      ) : (
                        <button
                          onClick={() => reativar(lead.lead_id)}
                          title="Devolver para a Bianca"
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded border border-emerald-500/20 hover:border-emerald-500/40"
                        >
                          <BotOff size={12} /> Devolver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}