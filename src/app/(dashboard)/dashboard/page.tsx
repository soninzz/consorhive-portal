'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { Users, MessageSquareText, PhoneForwarded, Activity, RefreshCw, Hexagon } from "lucide-react";
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  totalLeads: number;
  conversasAtivas: number;
  aguardandoConsultor: number;
  taxaResposta: number;
};

type Handoff = {
  lead_id: string;
  nome: string;
  updated_at: string;
  ticket_brl?: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    conversasAtivas: 0,
    aguardandoConsultor: 0,
    taxaResposta: 0,
  });
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregarDados() {
    setLoading(true);
    try {
      // Total de leads
      const { count: totalLeads } = await supabase
        .from('leads_qualificacao')
        .select('*', { count: 'exact', head: true });

      // Conversas ativas (bot ativo)
      const { count: conversasAtivas } = await supabase
        .from('leads_qualificacao')
        .select('*', { count: 'exact', head: true })
        .eq('status_bot', 'ativo');

      // Aguardando consultor (pausado para humano)
      const { count: aguardandoConsultor } = await supabase
        .from('leads_qualificacao')
        .select('*', { count: 'exact', head: true })
        .eq('status_bot', 'pausado_humano');

      // Taxa de resposta: qualificados / total
      const { count: qualificados } = await supabase
        .from('leads_qualificacao')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'qualificando');

      const taxa = totalLeads && totalLeads > 0
        ? Math.round(((qualificados ?? 0) / totalLeads) * 100 * 10) / 10
        : 0;

      // Últimos handoffs (leads com bot pausado, ordenados por update)
      const { data: handoffsData } = await supabase
        .from('leads_qualificacao')
        .select('lead_id, nome, updated_at')
        .eq('status_bot', 'pausado_humano')
        .order('updated_at', { ascending: false })
        .limit(5);

      setStats({
        totalLeads: totalLeads ?? 0,
        conversasAtivas: conversasAtivas ?? 0,
        aguardandoConsultor: aguardandoConsultor ?? 0,
        taxaResposta: taxa,
      });
      setHandoffs(handoffsData ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregarDados(); }, []);

  function tempoRelativo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Agora';
    if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Há ${Math.floor(diff / 3600)}h`;
    return `Há ${Math.floor(diff / 86400)}d`;
  }

  const kpis = [
    {
      label: 'Aguardando Consultor',
      value: loading ? '···' : String(stats.aguardandoConsultor),
      icon: PhoneForwarded,
      primary: true,
    },
    {
      label: 'Leads em Prospecção',
      value: loading ? '···' : stats.totalLeads.toLocaleString('pt-BR'),
      icon: Users,
      primary: false,
    },
    {
      label: 'Conversas Ativas',
      value: loading ? '···' : String(stats.conversasAtivas),
      icon: MessageSquareText,
      primary: false,
    },
    {
      label: 'Taxa de Engajamento',
      value: loading ? '···' : `${stats.taxaResposta}%`,
      icon: Activity,
      primary: false,
    },
  ];

  return (
    <div className="bg-honeycomb relative min-h-full flex-1 space-y-8 p-8 pt-7">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Operação em tempo real
          </p>
          <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* KPIs — mesma forma pra todos (retângulo, corte de canto sutil),
          hierarquia vem só de tipografia (tamanho/peso/cor) e espaço,
          não de um virar hexágono grande e os outros não. */}
      <div className="card-hex-cut-sm grid grid-cols-2 divide-x divide-y divide-border border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn('p-6', kpi.primary && 'bg-muted/40')}>
            <div className="flex items-center gap-1.5">
              <kpi.icon size={13} className="text-muted-foreground" strokeWidth={1.75} />
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
            </div>
            <p
              className={cn(
                'mt-2 tabular-nums leading-none',
                kpi.primary
                  ? 'font-heading text-4xl font-semibold text-primary'
                  : 'text-2xl font-medium text-foreground'
              )}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Painéis secundários */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="card-hex-cut-sm border border-border bg-card lg:col-span-4">
          <div className="border-b border-border px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Analytics</p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">Performance de Disparos</h3>
          </div>
          <div className="flex h-[220px] flex-col items-center justify-center gap-3 px-6">
            <Hexagon size={22} strokeWidth={1.25} className="text-muted-foreground/50" />
            <p className="max-w-[260px] text-center text-sm text-muted-foreground">
              O gráfico aparece assim que a primeira campanha for disparada.
            </p>
          </div>
        </div>

        <div className="card-hex-cut-sm border border-border bg-card lg:col-span-3">
          <div className="border-b border-border px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fila humana</p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">Últimos Handoffs</h3>
          </div>
          <div className="px-3 py-2">
            {loading ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Carregando...</p>
            ) : handoffs.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum handoff ainda.</p>
            ) : (
              handoffs.map((h) => (
                <div key={h.lead_id} className="flex items-center gap-3 rounded-md px-3 py-2.5">
                  <span className="hex-cell h-2 w-2 shrink-0 bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{h.nome}</p>
                    <p className="text-xs text-muted-foreground">Aguardando consultor</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tempoRelativo(h.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
