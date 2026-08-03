'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const kpis = [
    {
      label: 'Leads em Prospecção',
      value: loading ? '...' : stats.totalLeads.toLocaleString('pt-BR'),
      hint: 'Total de leads no sistema',
      icon: Users,
      accent: 'text-primary',
    },
    {
      label: 'Conversas Ativas (Automático)',
      value: loading ? '...' : stats.conversasAtivas,
      hint: 'Bot ativo respondendo',
      icon: MessageSquareText,
      accent: 'text-secondary',
    },
    {
      label: 'Aguardando Consultor',
      value: loading ? '...' : stats.aguardandoConsultor,
      hint: 'Leads aquecidos aguardando contato',
      icon: PhoneForwarded,
      accent: 'text-emerald-600',
      valueClass: 'text-emerald-600',
    },
    {
      label: 'Taxa de Engajamento',
      value: loading ? '...' : `${stats.taxaResposta}%`,
      hint: 'Leads que avançaram na qualificação',
      icon: Activity,
      accent: 'text-primary',
    },
  ];

  return (
    <div className="relative flex-1 space-y-6 bg-honeycomb p-8 pt-6">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            custom={i}
            initial="hidden"
            animate="show"
            variants={fadeUp}
          >
            <Card className="glass-panel group/kpi relative overflow-hidden border-none transition-transform hover:-translate-y-0.5">
              <div className="glow-blob glow-blob-gold absolute -right-6 -top-6 h-24 w-24 opacity-0 transition-opacity duration-300 group-hover/kpi:opacity-100" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
              </CardHeader>
              <CardContent className="relative">
                <div className={`text-2xl font-bold ${kpi.valueClass ?? 'text-foreground'}`}>
                  {kpi.value}
                </div>
                <p className="text-xs text-muted-foreground">{kpi.hint}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp} className="lg:col-span-4">
          <Card className="glass-panel border-none">
            <CardHeader>
              <CardTitle className="text-foreground">Performance de Disparos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-[250px] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
                Gráfico disponível após primeira campanha disparada
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp} className="lg:col-span-3">
          <Card className="glass-panel h-full border-none">
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
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
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