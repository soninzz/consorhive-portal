'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, type Campanha } from '@/lib/supabase';
import { primeiroNome, gerarMensagemUnica } from '@/lib/utils';
import { corStatus, formatarData } from '@/lib/utils';
import { Zap, Plus, Pause, RotateCcw, XCircle, BarChart2, ChevronRight, AlertCircle, Trash2 } from 'lucide-react';

type CampanhaComFila = Campanha & { restantes: number; naFila: number };

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<CampanhaComFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [continuarId, setContinuarId] = useState<string | null>(null);
  const [continuarQtd, setContinuarQtd] = useState('');
  const [continuando, setContinuando] = useState(false);
  const [erroContinuar, setErroContinuar] = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('v_campanhas_resumo')
      .select('*')
      .order('criada_em', { ascending: false });

    const lista = data ?? [];
    const comFila = await Promise.all(lista.map(async (c) => {
      const [{ count: restantes }, { count: naFila }] = await Promise.all([
        supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('lista_id', c.lista_id).eq('ja_contactado', false),
        supabase.from('disparos').select('id', { count: 'exact', head: true }).eq('campanha_id', c.id).eq('status', 'pendente'),
      ]);
      return { ...c, restantes: restantes ?? 0, naFila: naFila ?? 0 };
    }));

    setCampanhas(comFila);
    setLoading(false);
  }

  function abrirContinuar(c: CampanhaComFila) {
    setContinuarId(c.id);
    setContinuarQtd(String(c.restantes));
    setErroContinuar('');
  }

  async function continuarDisparo(c: CampanhaComFila) {
    const qtd = parseInt(continuarQtd, 10);
    if (!qtd || qtd <= 0) return;
    setContinuando(true);
    setErroContinuar('');

    try {
      const { data: template } = c.template_id
        ? await supabase.from('templates_mensagem').select('corpo').eq('id', c.template_id).single()
        : { data: null };
      if (!template) throw new Error('Template da campanha não encontrado.');

      const { data: contatos } = await supabase
        .from('contatos')
        .select('id, nome, telefone')
        .eq('lista_id', c.lista_id)
        .eq('ja_contactado', false)
        .not('telefone', 'is', null)
        .order('criado_em', { ascending: true })
        .limit(qtd);

      if (!contatos || contatos.length === 0) return;

      // Mensagem única por contato — mesma regra anti-repetição do disparo inicial
      const { data: jaEnviadas } = await supabase.from('disparos').select('mensagem_enviada');
      const usadas = new Set<string>((jaEnviadas ?? []).map(d => d.mensagem_enviada).filter(Boolean));

      const disparosPayload: { campanha_id: string; contato_id: string; telefone: string; mensagem_enviada: string; status: string }[] = [];
      let semVariacaoDisponivel = 0;
      for (const ct of contatos) {
        const mensagem = gerarMensagemUnica(template.corpo, { nome: primeiroNome(ct.nome) ?? 'você' }, usadas);
        if (!mensagem) {
          semVariacaoDisponivel++;
          continue;
        }
        disparosPayload.push({
          campanha_id: c.id,
          contato_id: ct.id,
          telefone: ct.telefone,
          mensagem_enviada: mensagem,
          status: 'pendente',
        });
      }

      if (semVariacaoDisponivel > 0) {
        throw new Error(
          `O template não tem variações suficientes: ${semVariacaoDisponivel} contato(s) ficariam com mensagem repetida. ` +
          `Edite o template em Configurações e adicione mais opções {a|b|c}, ou reduza a quantidade.`
        );
      }

      for (let i = 0; i < disparosPayload.length; i += 500) {
        await supabase.from('disparos').insert(disparosPayload.slice(i, i + 500));
      }

      await supabase.from('campanhas').update({
        total_planejado: c.total_planejado + contatos.length,
        status: 'rodando',
      }).eq('id', c.id);

      await fetch('/api/disparo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha_id: c.id }),
      });

      setContinuarId(null);
      carregar();
    } catch (e: unknown) {
      setErroContinuar(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setContinuando(false);
    }
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

  async function excluirCampanha(c: CampanhaComFila) {
    if (!confirm(`Excluir "${c.nome}" da lista? Isso remove o histórico de disparos dela permanentemente.`)) return;
    await supabase.from('disparos').delete().eq('campanha_id', c.id);
    await supabase.from('campanhas').delete().eq('id', c.id);
    setCampanhas(prev => prev.filter(x => x.id !== c.id));
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
          <h2 className="text-2xl font-bold text-foreground">Campanhas</h2>
          <p className="text-muted-foreground text-sm mt-1">Crie e acompanhe seus disparos de prospecção.</p>
        </div>
        <Link
          href="/campanhas/nova"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nova Campanha
        </Link>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando campanhas...</div>
      ) : campanhas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center">
          <Zap size={40} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma campanha ainda</p>
          <p className="text-muted-foreground text-sm mt-1">Crie uma campanha pra começar a prospectar.</p>
          <Link href="/campanhas/nova" className="mt-4 inline-block text-emerald-600 text-sm hover:text-emerald-700">
            Criar campanha →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campanhas.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-foreground font-semibold truncate">{c.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${corStatus(c.status)}`}>
                      {labelStatus[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Lista: <span className="text-muted-foreground">{c.lista_nome ?? '—'}</span>
                    {c.template_nome && <> · Template: <span className="text-muted-foreground">{c.template_nome}</span></>}
                    · Criada em <span className="text-muted-foreground">{formatarData(c.criada_em)}</span>
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'rodando' && (
                    <button onClick={() => pausar(c.id)} className="flex items-center gap-1 text-xs text-yellow-700 hover:text-yellow-800 transition-colors px-3 py-1.5 rounded-lg border border-yellow-500/20 hover:border-yellow-500/40">
                      <Pause size={13} /> Pausar
                    </button>
                  )}
                  {c.status === 'pausada' && (
                    <button onClick={() => retomar(c.id)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40">
                      <RotateCcw size={13} /> Retomar
                    </button>
                  )}
                  {(c.status === 'rodando' || c.status === 'pausada' || c.status === 'rascunho') && (
                    <button onClick={() => cancelar(c.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-red-500/30">
                      <XCircle size={13} /> Cancelar
                    </button>
                  )}
                  {c.status !== 'cancelada' && c.naFila === 0 && c.restantes > 0 && (
                    <button onClick={() => abrirContinuar(c)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg border border-primary/30 hover:border-primary/50">
                      <ChevronRight size={13} /> Continuar disparo ({c.restantes} restantes)
                    </button>
                  )}
                  {(c.status === 'concluida' || c.status === 'cancelada') && (
                    <button onClick={() => excluirCampanha(c)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-red-500/30" title="Excluir da lista">
                      <Trash2 size={13} /> Excluir
                    </button>
                  )}
                </div>
              </div>

              {/* Métricas */}
              <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-border">
                <Metrica label="Planejado" valor={c.total_planejado} />
                <Metrica label="Enviado" valor={c.total_enviado} cor="text-emerald-600" />
                <Metrica label="Falhou" valor={c.total_falhou} cor={c.total_falhou > 0 ? 'text-red-600' : undefined} />
                <Metrica label="Respondeu" valor={c.total_respondeu} cor="text-yellow-700" extra={c.taxa_resposta ? `${c.taxa_resposta}%` : undefined} />
              </div>

              {/* Barra de progresso */}
              {c.total_planejado > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (c.total_enviado / c.total_planejado) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((c.total_enviado / c.total_planejado) * 100)}% concluído
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {continuarId && (() => {
        const c = campanhas.find(x => x.id === continuarId);
        if (!c) return null;
        const qtd = parseInt(continuarQtd, 10);
        const qtdValida = continuarQtd.trim() !== '' && qtd > 0 && qtd <= c.restantes;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4">
              <div>
                <h3 className="text-foreground font-semibold">Continuar disparo</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {c.nome} · {c.restantes} contatos ainda não contactados na lista.
                </p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Quantos disparar agora?</label>
                <input
                  type="number"
                  min={1}
                  max={c.restantes}
                  value={continuarQtd}
                  onChange={e => setContinuarQtd(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => setContinuarQtd(String(c.restantes))}
                  className="text-xs text-primary hover:underline mt-1.5"
                >
                  Usar todos os restantes ({c.restantes})
                </button>
                {!qtdValida && (
                  <p className="text-xs text-red-600 mt-1.5">Informe um número entre 1 e {c.restantes}.</p>
                )}
              </div>
              {erroContinuar && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                  <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-red-600 text-xs">{erroContinuar}</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => { setContinuarId(null); setErroContinuar(''); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => continuarDisparo(c)}
                  disabled={continuando || !qtdValida}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Zap size={14} />
                  {continuando ? 'Disparando...' : 'Disparar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Metrica({ label, valor, cor, extra }: { label: string; valor: number; cor?: string; extra?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${cor ?? 'text-foreground'}`}>
        {valor.toLocaleString('pt-BR')}
        {extra && <span className="text-xs font-normal text-muted-foreground ml-1">({extra})</span>}
      </p>
    </div>
  );
}