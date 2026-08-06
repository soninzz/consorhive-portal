'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HexIcon } from "@/components/ui/hex";
import { Users, MessageSquareText, PhoneForwarded, Activity, RefreshCw } from "lucide-react";
import { supabase } from '@/lib/supabase';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

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

  const primaryKpi = {
    label: 'Aguardando Consultor',
    value: loading ? '...' : stats.aguardandoConsultor,
    hint: 'Leads aquecidos prontos pra contato humano agora',
    icon: PhoneForwarded,
  };

  const secondaryKpis = [
    {
      label: 'Leads em Prospecção',
      value: loading ? '...' : stats.totalLeads.toLocaleString('pt-BR'),
      hint: 'Total de leads no sistema',
      icon: Users,
    },
    {
      label: 'Conversas Ativas',
      value: loading ? '...' : stats.conversasAtivas,
      hint: 'Bot ativo respondendo agora',
      icon: MessageSquareText,
    },
    {
      label: 'Taxa de Engajamento',
      value: loading ? '...' : `${stats.taxaResposta}%`,
      hint: 'Leads que avançaram na qualificação',
      icon: Activity,
    },
  ];

  return (
    <div className="bg-honeycomb relative flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Visão Geral da Operação</span>
          <button
            onClick={carregarDados}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* KPI principal — a métrica acionável do momento, tratamento de destaque */}
        <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp} className="lg:col-span-1">
          <Card className="card-hex-cut card-hex-frame relative h-full overflow-hidden border-none bg-gradient-to-br from-primary/15 via-card to-card p-1 ring-1 ring-primary/25">
            <div className="glow-blob glow-blob-gold animate-pulse-glow absolute -right-8 -top-8 h-32 w-32 opacity-70" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium text-foreground/80">{primaryKpi.label}</CardTitle>
              <HexIcon size="lg" className="from-primary/50 to-primary/10">
                <primaryKpi.icon className="h-5 w-5 text-primary" />
              </HexIcon>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-primary">{primaryKpi.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{primaryKpi.hint}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPIs secundários — mesma família visual, peso menor */}
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          {secondaryKpis.map((kpi, i) => (
            <motion.div key={kpi.label} custom={i + 1} initial="hidden" animate="show" variants={fadeUp}>
              <Card className="card-hex-cut-sm group/kpi relative h-full overflow-hidden border-none bg-card/80 ring-1 ring-border/60 transition-colors hover:ring-primary/30">
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
                  <HexIcon size="sm">
                    <kpi.icon className="h-3.5 w-3.5 text-primary" />
                  </HexIcon>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-xl font-bold text-foreground">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">{kpi.hint}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp} className="lg:col-span-4">
          <Card className="card-hex-cut glass-panel border-none">
            <CardHeader>
              <CardTitle className="text-foreground">Performance de Disparos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative flex h-[250px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-border/70 bg-muted/30">
                <div className="flex items-end gap-1.5">
                  {[0, 1, 2, 3, 2, 1, 0].map((delay, i) => (
                    <span
                      key={i}
                      className="hex-cell animate-pulse-glow h-6 w-6 bg-primary/25"
                      style={{ animationDelay: `${delay * 0.35}s` }}
                    />
                  ))}
                </div>
                <p className="max-w-[220px] text-center text-sm text-muted-foreground">
                  Seu enxame está pronto — o gráfico aparece assim que a primeira campanha for disparada
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp} className="lg:col-span-3">
          <Card className="card-hex-cut glass-panel h-full border-none">
            <CardHeader>
              <CardTitle className="text-foreground">Últimos Handoffs</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : handoffs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum handoff ainda.</p>
              ) : (
                <div className="space-y-5">
                  {handoffs.map((h) => (
                    <div key={h.lead_id} className="flex items-center">
                      <span className="hex-cell hex-cell-active h-3 w-3 shrink-0 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      <div className="ml-3 space-y-1">
                        <p className="text-sm font-medium text-foreground">{h.nome}</p>
                        <p className="text-xs text-muted-foreground">Aguardando consultor</p>
                      </div>
                      <div className="ml-auto text-sm text-emerald-600">
                        {tempoRelativo(h.updated_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}