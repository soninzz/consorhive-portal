'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, type Campanha } from '@/lib/supabase';
import { corStatus, formatarData } from '@/lib/utils';
import { Zap, Plus, Pause, RotateCcw, XCircle, BarChart2 } from 'lucide-react';

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('v_campanhas_resumo')
      .select('*')
      .order('criada_em', { ascending: false });
    setCampanhas(data ?? []);
    setLoading(false);
  }

  async function pausar(id: string) {
    await supabase.from('campanhas').update({ status: 'pausada' }).eq('id', id);
    // Notifica n8n para parar os disparos desta campanha
    await fetch('/api/campanhas/pausar', { method: 'POST', body: JSON.stringify({ campanha_id: id }), headers: { 'Content-Type': 'application/json' } });
    carregar();
  }

  async function retomar(id: string) {
    await supabase.from('campanhas').update({ status: 'rodando' }).eq('id', id);
    await fetch('/api/campanhas/retomar', { method: 'POST', body: JSON.stringify({ campanha_id: id }), headers: { 'Content-Type': 'application/json' } });
    carregar();
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar esta campanha? Os disparos pendentes serão removidos.')) return;
    await supabase.from('campanhas').update({ status: 'cancelada' }).eq('id', id);
    await supabase.from('disparos').delete().eq('campanha_id', id).eq('status', 'pendente');
    carregar();
  }

  const labelStatus: Record<string, string> = {
    rascunho: 'Rascunho',
    rodando: 'Rodando',
    pausada: 'Pausada',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  return (
    <div className="flex-1 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Campanhas</h2>
          <p className="text-slate-400 text-sm mt-1">Crie e acompanhe seus disparos de prospecção.</p>
        </div>
        <Link
          href="/campanhas/nova"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nova Campanha
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando campanhas...</div>
      ) : campanhas.length === 0 ? (
        <div className="border border-dashed border-slate-700 rounded-xl p-16 text-center">
          <Zap size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Nenhuma campanha ainda</p>
          <p className="text-slate-600 text-sm mt-1">Crie uma campanha para a Bianca começar a prospectar.</p>
          <Link href="/campanhas/nova" className="mt-4 inline-block text-emerald-400 text-sm hover:text-emerald-300">
            Criar campanha →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campanhas.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-slate-100 font-semibold truncate">{c.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${corStatus(c.status)}`}>
                      {labelStatus[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Lista: <span className="text-slate-400">{c.lista_nome ?? '—'}</span>
                    {c.template_nome && <> · Template: <span className="text-slate-400">{c.template_nome}</span></>}
                    · Criada em <span className="text-slate-400">{formatarData(c.criada_em)}</span>
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'rodando' && (
                    <button onClick={() => pausar(c.id)} className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors px-3 py-1.5 rounded-lg border border-yellow-500/20 hover:border-yellow-500/40">
                      <Pause size={13} /> Pausar
                    </button>
                  )}
                  {c.status === 'pausada' && (
                    <button onClick={() => retomar(c.id)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40">
                      <RotateCcw size={13} /> Retomar
                    </button>
                  )}
                  {(c.status === 'rodando' || c.status === 'pausada' || c.status === 'rascunho') && (
                    <button onClick={() => cancelar(c.id)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-500/30">
                      <XCircle size={13} /> Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Métricas */}
              <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-slate-800">
                <Metrica label="Planejado" valor={c.total_planejado} />
                <Metrica label="Enviado" valor={c.total_enviado} cor="text-emerald-400" />
                <Metrica label="Falhou" valor={c.total_falhou} cor={c.total_falhou > 0 ? 'text-red-400' : undefined} />
                <Metrica label="Respondeu" valor={c.total_respondeu} cor="text-yellow-400" extra={c.taxa_resposta ? `${c.taxa_resposta}%` : undefined} />
              </div>

              {/* Barra de progresso */}
              {c.total_planejado > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (c.total_enviado / c.total_planejado) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {Math.round((c.total_enviado / c.total_planejado) * 100)}% concluído
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metrica({ label, valor, cor, extra }: { label: string; valor: number; cor?: string; extra?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${cor ?? 'text-slate-200'}`}>
        {valor.toLocaleString('pt-BR')}
        {extra && <span className="text-xs font-normal text-slate-500 ml-1">({extra})</span>}
      </p>
    </div>
  );
}