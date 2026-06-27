'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, type Lista, type Template } from '@/lib/supabase';
import { interpolarTemplate } from '@/lib/utils';
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

  useEffect(() => {
    supabase.from('listas').select('*').order('criada_em', { ascending: false }).then(({ data }) => setListas(data ?? []));
    supabase.from('templates_mensagem').select('*').eq('ativo', true).then(({ data }) => setTemplates(data ?? []));
  }, []);

  useEffect(() => {
    if (listaId) {
      const l = listas.find(x => x.id === listaId) ?? null;
      setListaSelecionada(l);
      supabase.from('contatos').select('nome').eq('lista_id', listaId).limit(3).then(({ data }) => {
        setPreviewNomes((data ?? []).map(c => c.nome ?? 'Contato'));
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

      // 2. Buscar contatos não contactados
      const { data: contatos } = await supabase
        .from('contatos')
        .select('id, nome, telefone')
        .eq('lista_id', listaId)
        .eq('ja_contactado', false)
        .not('telefone', 'is', null);

      if (!contatos || contatos.length === 0) {
        throw new Error('Nenhum contato disponível nesta lista (todos já foram contactados).');
      }

      // 3. Criar registros de disparos pendentes
      const corpo = templateSelecionado!.corpo;
      const disparosPayload = contatos.map(c => ({
        campanha_id: campanha.id,
        contato_id: c.id,
        telefone: c.telefone,
        mensagem_enviada: interpolarTemplate(corpo, { nome: c.nome ?? 'você' }),
        status: 'pendente',
      }));

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
  const estimativaHoras = listaSelecionada
    ? Math.ceil((listaSelecionada.total_contatos * 90) / 3600)
    : 0;

  return (
    <div className="flex-1 p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-50">Nova Campanha</h2>
        <p className="text-slate-400 text-sm mt-1">Configure e dispare uma prospecção com a Bianca.</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((p) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              passo === p ? 'bg-emerald-600 text-white' :
              passo > p ? 'bg-emerald-900 text-emerald-400' :
              'bg-slate-800 text-slate-500'
            }`}>{p}</div>
            {p < 3 && <div className={`h-px w-8 ${passo > p ? 'bg-emerald-700' : 'bg-slate-800'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-slate-500">
          {passo === 1 ? 'Lista e nome' : passo === 2 ? 'Mensagem' : 'Confirmar'}
        </span>
      </div>

      {passo === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nome da campanha</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Prospecção Imobiliárias SC — Jun/26"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Lista de contatos</label>
            {listas.length === 0 ? (
              <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-500 text-sm">
                Nenhuma lista disponível. <a href="/listas" className="text-emerald-400 hover:underline">Importe uma lista primeiro.</a>
              </div>
            ) : (
              <select
                value={listaId}
                onChange={e => setListaId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Selecione uma lista...</option>
                {listas.map(l => (
                  <option key={l.id} value={l.id}>{l.nome} ({l.total_contatos.toLocaleString('pt-BR')} contatos)</option>
                ))}
              </select>
            )}
            {listaSelecionada && (
              <p className="text-xs text-slate-500 mt-1.5">
                {listaSelecionada.contactados > 0
                  ? `${listaSelecionada.total_contatos - listaSelecionada.contactados} contatos disponíveis (${listaSelecionada.contactados} já contactados)`
                  : `${listaSelecionada.total_contatos} contatos disponíveis`}
              </p>
            )}
          </div>
          <button
            onClick={() => setPasso(2)}
            disabled={!podeProsseguir1}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Próximo <ChevronRight size={16} />
          </button>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Escolha o template de mensagem</label>
            <div className="space-y-3">
              {templates.map(t => (
                <label key={t.id} className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
                  templateId === t.id ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}>
                  <div className="flex items-start gap-3">
                    <input type="radio" name="template" value={t.id} checked={templateId === t.id} onChange={e => setTemplateId(e.target.value)} className="mt-1 accent-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium text-sm">{t.nome}</p>
                      <p className="text-slate-500 text-xs mt-1 line-clamp-3 whitespace-pre-wrap">{t.corpo}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {templateId && previewNomes.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-3">Preview com contatos reais</p>
              {previewNomes.slice(0, 1).map((nome, i) => (
                <div key={i} className="bg-emerald-950/40 border border-emerald-900/30 rounded-lg p-3">
                  <p className="text-xs text-emerald-600 mb-1">Para: {nome}</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {interpolarTemplate(templateSelecionado?.corpo ?? '', { nome })}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setPasso(1)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Voltar
            </button>
            <button
              onClick={() => setPasso(3)}
              disabled={!podeProsseguir2}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Próximo <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-slate-200 font-semibold">Resumo da campanha</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Nome</p>
                <p className="text-slate-200 font-medium mt-0.5">{nome}</p>
              </div>
              <div>
                <p className="text-slate-500">Lista</p>
                <p className="text-slate-200 font-medium mt-0.5">{listaSelecionada?.nome}</p>
              </div>
              <div>
                <p className="text-slate-500">Contatos</p>
                <p className="text-slate-200 font-medium mt-0.5">{listaSelecionada?.total_contatos.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-slate-500">Template</p>
                <p className="text-slate-200 font-medium mt-0.5">{templateSelecionado?.nome}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4 flex gap-3">
            <Clock size={18} className="text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 text-sm font-medium">Ritmo anti-ban</p>
              <p className="text-yellow-600 text-xs mt-1">
                Disparos com 60–90s de intervalo. Estimativa: ~{estimativaHoras}h para completar a lista.
                Não ultrapassa 300 mensagens/dia.
              </p>
            </div>
          </div>

          {erro && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 flex gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{erro}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setPasso(2)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Voltar
            </button>
            <button
              onClick={disparar}
              disabled={disparando}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Zap size={16} />
              {disparando ? 'Iniciando...' : 'Iniciar Campanha'}
            </button>
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