'use client';

import { useState, useEffect } from 'react';
import { supabase, type Lead } from '@/lib/supabase';
import { bgTemperatura, formatarData } from '@/lib/utils';
import { HexBadge, HexIcon } from '@/components/ui/hex';
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
          <h2 className="text-2xl font-bold text-foreground">Leads</h2>
          <p className="text-muted-foreground text-sm mt-1">Todos os contatos que interagiram com o número.</p>
        </div>
        <button onClick={carregar} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="bg-card border border-border rounded-lg pl-8 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary w-64"
          />
        </div>
        <select
          value={filtroTemperatura}
          onChange={e => setFiltroTemperatura(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">Todas temperaturas</option>
          <option value="quente">🔥 Quente</option>
          <option value="morno">🌡 Morno</option>
          <option value="frio">🧊 Frio</option>
        </select>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">Todos os status</option>
          <option value="qualificando">Qualificando</option>
          <option value="handoff">Handoff</option>
          <option value="pausado">Pausado</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando leads...</div>
      ) : filtrados.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center">
          <HexIcon size="lg" className="mx-auto mb-4">
            <Users size={20} className="text-muted-foreground" />
          </HexIcon>
          <p className="text-muted-foreground font-medium">Nenhum lead ainda</p>
          <p className="text-muted-foreground text-sm mt-1">Quando uma campanha iniciar uma campanha, os leads aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-honeycomb card-hex-cut bg-card border border-border overflow-hidden">
          <div className="px-6 py-3 border-b border-border text-xs text-muted-foreground">
            {filtrados.length} lead{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Nome / Telefone</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Temperatura</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Etapa</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Dor principal</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Última interação</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Bot</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((lead) => (
                <tr key={lead.lead_id} className="border-b border-border/60 hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-foreground font-medium">{lead.nome || '—'}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{lead.lead_id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <HexBadge className={`border ${bgTemperatura(lead.temperatura)}`}>
                      {lead.temperatura}
                    </HexBadge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {labelEtapa[lead.etapa_funil] ?? lead.etapa_funil}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs max-w-[200px] truncate">
                    {lead.dor_principal ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {lead.ultima_interacao ? formatarData(lead.ultima_interacao) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <HexBadge className={
                      lead.status_bot === 'ativo'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground'
                    }>
                      {lead.status_bot === 'ativo' ? 'Ativa' : 'Pausada'}
                    </HexBadge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      {lead.status_bot === 'ativo' ? (
                        <button
                          onClick={() => assumir(lead.lead_id)}
                          title="Assumir conversa (pausa o automático)"
                          className="flex items-center gap-1 text-xs text-yellow-700 hover:text-yellow-800 transition-colors px-2 py-1 rounded border border-yellow-500/20 hover:border-yellow-500/40"
                        >
                          <UserCheck size={12} /> Assumir
                        </button>
                      ) : (
                        <button
                          onClick={() => reativar(lead.lead_id)}
                          title="Devolver para o automático"
                          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors px-2 py-1 rounded border border-emerald-500/20 hover:border-emerald-500/40"
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