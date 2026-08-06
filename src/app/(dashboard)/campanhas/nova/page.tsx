'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, type Lista, type Template } from '@/lib/supabase';
import { interpolarTemplate, primeiroNome, contarCombinacoesSpintax, gerarMensagemUnica } from '@/lib/utils';
import { HexStepper } from '@/components/ui/hex-stepper';
import { Button } from '@/components/ui/button';
import { ChevronRight, Zap, Clock, AlertCircle } from 'lucide-react';

function NovaCampanhaForm() {
  const router = useRouter();
  const params = useSearchParams();
  const listaPreSelecionada = params.get('lista') ?? '';

  const [passo, setPasso] = useState(1);
  const [listas, setListas] = useState<Lista[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [nome, setNome] = useState('');
  const [listaId, setListaId] = useState(listaPreSelecionada);
  const [templateId, setTemplateId] = useState('');
  const [listaSelecionada, setListaSelecionada] = useState<Lista | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<Template | null>(null);
  const [previewNomes, setPreviewNomes] = useState<string[]>([]);
  const [disparando, setDisparando] = useState(false);
  const [erro, setErro] = useState('');
  const [disponiveis, setDisponiveis] = useState<number | null>(null);
  const [modoQuantidade, setModoQuantidade] = useState<'todos' | 'parcial'>('todos');
  const [quantidade, setQuantidade] = useState('');

  useEffect(() => {
    supabase.from('listas').select('*').order('criada_em', { ascending: false }).then(({ data }) => setListas(data ?? []));
    supabase.from('templates_mensagem').select('*').eq('ativo', true).then(({ data }) => setTemplates(data ?? []));
  }, []);

  useEffect(() => {
    if (listaId) {
      const l = listas.find(x => x.id === listaId) ?? null;
      setListaSelecionada(l);
      setModoQuantidade('todos');
      setQuantidade('');
      supabase.from('contatos').select('nome').eq('lista_id', listaId).eq('ja_contactado', false).limit(3).then(({ data }) => {
        setPreviewNomes((data ?? []).map(c => c.nome ?? 'Contato'));
      });
      supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('lista_id', listaId).eq('ja_contactado', false).then(({ count }) => {
        setDisponiveis(count ?? 0);
      });
    }
  }, [listaId, listas]);

  useEffect(() => {
    if (templateId) {
      setTemplateSelecionado(templates.find(t => t.id === templateId) ?? null);
    }
  }, [templateId, templates]);

  async function disparar() {
    if (!listaId || !templateId || !nome.trim()) return;
    if (modoQuantidade === 'parcial' && !(quantidade.trim() !== '' && parseInt(quantidade, 10) > 0)) return;
    setDisparando(true);
    setErro('');

    try {
      // 1. Criar campanha no Supabase
      const { data: campanha, error } = await supabase
        .from('campanhas')
        .insert({
          nome: nome.trim(),
          lista_id: listaId,
          template_id: templateId,
          status: 'rodando',
          total_planejado: listaSelecionada?.total_contatos ?? 0,
        })
        .select()
        .single();

      if (error || !campanha) throw new Error(error?.message ?? 'Erro ao criar campanha');

      // 2. Buscar contatos não contactados (mais antigos primeiro, pra "primeiros N" ser determinístico)
      let query = supabase
        .from('contatos')
        .select('id, nome, telefone')
        .eq('lista_id', listaId)
        .eq('ja_contactado', false)
        .not('telefone', 'is', null)
        .order('criado_em', { ascending: true });

      const limite = modoQuantidade === 'parcial' ? parseInt(quantidade, 10) : null;
      if (limite && limite > 0) query = query.limit(limite);

      const { data: contatos } = await query;

      if (!contatos || contatos.length === 0) {
        throw new Error('Nenhum contato disponível nesta lista (todos já foram contactados).');
      }

      // 3. Monta mensagem única por contato — nunca repete o mesmo texto final
      // pra números diferentes (é o padrão que derruba número no anti-spam do WhatsApp)
      const corpo = templateSelecionado!.corpo;
      const { data: jaEnviadas } = await supabase.from('disparos').select('mensagem_enviada');
      const usadas = new Set<string>((jaEnviadas ?? []).map(d => d.mensagem_enviada).filter(Boolean));

      const disparosPayload: { campanha_id: string; contato_id: string; telefone: string; mensagem_enviada: string; status: string }[] = [];
      let semVariacaoDisponivel = 0;
      for (const c of contatos) {
        const mensagem = gerarMensagemUnica(corpo, { nome: primeiroNome(c.nome) ?? 'você' }, usadas);
        if (!mensagem) {
          semVariacaoDisponivel++;
          continue;
        }
        disparosPayload.push({
          campanha_id: campanha.id,
          contato_id: c.id,
          telefone: c.telefone,
          mensagem_enviada: mensagem,
          status: 'pendente',
        });
      }

      if (semVariacaoDisponivel > 0) {
        await supabase.from('campanhas').delete().eq('id', campanha.id);
        throw new Error(
          `O template não tem variações suficientes: ${semVariacaoDisponivel} contato(s) ficariam com mensagem repetida. ` +
          `Adicione mais opções entre chaves no template, ex: {opção 1|opção 2|opção 3}, e tente de novo.`
        );
      }

      for (let i = 0; i < disparosPayload.length; i += 500) {
        await supabase.from('disparos').insert(disparosPayload.slice(i, i + 500));
      }

      await supabase.from('campanhas').update({ total_planejado: contatos.length }).eq('id', campanha.id);

      // 4. Chamar rota proxy para o n8n (evita CORS)
      console.log('Chamando disparo para campanha:', campanha.id);
      await fetch('/api/disparo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha_id: campanha.id }),
      });

      router.push('/campanhas');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
      setDisparando(false);
    }
  }

  const podeProsseguir1 = nome.trim().length > 0 && listaId;
  const podeProsseguir2 = templateId;
  const quantidadeValida = modoQuantidade === 'todos' || (
    quantidade.trim() !== '' && parseInt(quantidade, 10) > 0 && (disponiveis === null || parseInt(quantidade, 10) <= disponiveis)
  );
  const quantidadeAlvo = modoQuantidade === 'parcial' && quantidade
    ? Math.min(parseInt(quantidade, 10) || 0, disponiveis ?? 0)
    : (disponiveis ?? 0);
  const estimativaHoras = Math.ceil((quantidadeAlvo * 90) / 3600);

  return (
    <div className="bg-honeycomb relative min-h-full flex-1 max-w-2xl space-y-8 p-8 pt-7">
      <div className="border-b border-border pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Nova prospecção</p>
        <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground">Nova Campanha</h2>
        <p className="text-muted-foreground text-sm mt-1.5">Configure e dispare uma prospecção como Maikon.</p>
      </div>

      <HexStepper
        current={passo}
        steps={[
          { label: 'Lista e nome' },
          { label: 'Mensagem' },
          { label: 'Confirmar' },
        ]}
      />

      {passo === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome da campanha</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Prospecção Imobiliárias SC — Jun/26"
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Lista de contatos</label>
            {listas.length === 0 ? (
              <div className="bg-card border border-border rounded-lg px-4 py-3 text-muted-foreground text-sm">
                Nenhuma lista disponível. <a href="/listas" className="text-emerald-600 hover:underline">Importe uma lista primeiro.</a>
              </div>
            ) : (
              <select
                value={listaId}
                onChange={e => setListaId(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Selecione uma lista...</option>
                {listas.map(l => (
                  <option key={l.id} value={l.id}>{l.nome} ({l.total_contatos.toLocaleString('pt-BR')} contatos)</option>
                ))}
              </select>
            )}
            {listaSelecionada && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {listaSelecionada.contactados > 0
                  ? `${listaSelecionada.total_contatos - listaSelecionada.contactados} contatos disponíveis (${listaSelecionada.contactados} já contactados)`
                  : `${listaSelecionada.total_contatos} contatos disponíveis`}
              </p>
            )}
          </div>
          <Button onClick={() => setPasso(2)} disabled={!podeProsseguir1}>
            Próximo <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Escolha o template de mensagem</label>
            {templates.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Nenhum template ativo ainda.{' '}
                <a href="/configuracoes" className="text-primary hover:underline">
                  Crie um template em Configurações
                </a>{' '}
                antes de continuar.
              </div>
            )}
            <div className="space-y-3">
              {templates.map(t => (
                <label key={t.id} className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
                  templateId === t.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-border'
                }`}>
                  <div className="flex items-start gap-3">
                    <input type="radio" name="template" value={t.id} checked={templateId === t.id} onChange={e => setTemplateId(e.target.value)} className="mt-1 accent-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium text-sm">{t.nome}</p>
                      <p className="text-muted-foreground text-xs mt-1 line-clamp-3 whitespace-pre-wrap">{t.corpo}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {templateId && previewNomes.length > 0 && (
            <div className="bg-muted/60 rounded-xl p-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-1">
                Preview com contatos reais — repare que o texto varia mesmo entre contatos, isso é proposital (evita mensagem repetida)
              </p>
              {previewNomes.slice(0, 3).map((nome, i) => (
                <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs text-primary mb-1">Para: {nome}</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {interpolarTemplate(templateSelecionado?.corpo ?? '', { nome: primeiroNome(nome) ?? 'você' })}
                  </p>
                </div>
              ))}
            </div>
          )}

          {templateId && templateSelecionado && (() => {
            const combinacoes = contarCombinacoesSpintax(templateSelecionado.corpo);
            const poucaVariacao = combinacoes < (disponiveis ?? 0);
            return (
              <div className={`rounded-lg px-4 py-2.5 text-xs flex items-center gap-2 ${poucaVariacao ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-muted/60 text-muted-foreground'}`}>
                {poucaVariacao && <AlertCircle size={14} className="shrink-0" />}
                {combinacoes >= 999999
                  ? 'Variações praticamente ilimitadas para este template.'
                  : `Este template gera até ${combinacoes.toLocaleString('pt-BR')} mensagem(ns) distinta(s).`}
                {poucaVariacao && ` Isso é menos que os ${disponiveis} contatos disponíveis — adicione mais opções {a|b|c} no template ou reduza a quantidade disparada.`}
              </div>
            );
          })()}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setPasso(1)}>
              Voltar
            </Button>
            <Button onClick={() => setPasso(3)} disabled={!podeProsseguir2}>
              Próximo <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-5">
          <div className="card-hex-cut border border-border bg-card p-5 space-y-4">
            <h3 className="text-foreground font-semibold">Resumo da campanha</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nome</p>
                <p className="text-foreground font-medium mt-0.5">{nome}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lista</p>
                <p className="text-foreground font-medium mt-0.5">{listaSelecionada?.nome}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Disponíveis na lista</p>
                <p className="text-foreground font-medium mt-0.5">{disponiveis?.toLocaleString('pt-BR') ?? '...'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Template</p>
                <p className="text-foreground font-medium mt-0.5">{templateSelecionado?.nome}</p>
              </div>
            </div>
          </div>

          <div className="card-hex-cut border border-border bg-card p-5 space-y-3">
            <h3 className="text-foreground font-semibold text-sm">Quantos disparar agora?</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="modoQuantidade"
                  checked={modoQuantidade === 'todos'}
                  onChange={() => setModoQuantidade('todos')}
                  className="accent-primary"
                />
                Todos os disponíveis agora ({disponiveis?.toLocaleString('pt-BR') ?? '...'})
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="modoQuantidade"
                  checked={modoQuantidade === 'parcial'}
                  onChange={() => setModoQuantidade('parcial')}
                  className="accent-primary"
                />
                Só os primeiros
                <input
                  type="number"
                  min={1}
                  max={disponiveis ?? undefined}
                  value={quantidade}
                  onFocus={() => setModoQuantidade('parcial')}
                  onChange={e => { setQuantidade(e.target.value); setModoQuantidade('parcial'); }}
                  placeholder="ex: 10"
                  className="w-24 bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                contatos
              </label>
            </div>
            {modoQuantidade === 'parcial' && !quantidadeValida && (
              <p className="text-xs text-red-600">Informe um número entre 1 e {disponiveis ?? 0}.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Depois dá pra voltar em Campanhas e continuar o resto da lista com outra quantidade, quando quiser.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
            <Clock size={18} className="text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-700 text-sm font-medium">Ritmo anti-ban</p>
              <p className="text-yellow-600 text-xs mt-1">
                Disparos com 60–90s de intervalo. Estimativa: ~{estimativaHoras}h para completar a lista.
                Não ultrapassa 300 mensagens/dia.
              </p>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <p className="text-red-600 text-sm">{erro}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setPasso(2)}>
              Voltar
            </Button>
            <Button size="lg" onClick={disparar} disabled={disparando || !quantidadeValida}>
              <Zap size={16} />
              {disparando ? 'Iniciando...' : 'Iniciar Campanha'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NovaCampanhaPage() {
  return (
    <Suspense>
      <NovaCampanhaForm />
    </Suspense>
  );
}