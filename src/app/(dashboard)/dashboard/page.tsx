'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquareText, PhoneForwarded, Activity, RefreshCw } from "lucide-react";
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

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50">Dashboard</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Visão Geral da Operação</span>
          <button
            onClick={carregarDados}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Leads em Prospecção</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {loading ? '...' : stats.totalLeads.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-slate-500">Total de leads no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Conversas Ativas (Bianca)</CardTitle>
            <MessageSquareText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {loading ? '...' : stats.conversasAtivas}
            </div>
            <p className="text-xs text-slate-500">Bot ativo respondendo</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Aguardando Consultor</CardTitle>
            <PhoneForwarded className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {loading ? '...' : stats.aguardandoConsultor}
            </div>
            <p className="text-xs text-slate-500">Leads aquecidos aguardando contato</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Taxa de Engajamento</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {loading ? '...' : `${stats.taxaResposta}%`}
            </div>
            <p className="text-xs text-slate-500">Leads que avançaram na qualificação</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Performance de Disparos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full rounded-md border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-sm">
              Gráfico disponível após primeira campanha disparada
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Últimos Handoffs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-500 text-sm">Carregando...</p>
            ) : handoffs.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhum handoff ainda.</p>
            ) : (
              <div className="space-y-6">
                {handoffs.map((h) => (
                  <div key={h.lead_id} className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium text-slate-200">{h.nome}</p>
                      <p className="text-xs text-slate-500">Aguardando consultor</p>
                    </div>
                    <div className="ml-auto text-sm text-emerald-400">
                      {tempoRelativo(h.updated_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}