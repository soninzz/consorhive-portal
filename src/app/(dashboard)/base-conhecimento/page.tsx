'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, type BaseConhecimento } from '@/lib/supabase';
import { formatarData } from '@/lib/utils';
import { Save, RotateCcw, BookOpen, CheckCircle, Upload, FileText, X, MessageSquare, Send, Trash2, Bot, Flame } from 'lucide-react';
import { useConfirm } from '@/hooks/use-confirm';

type MensagemTeste = {
  role: 'user' | 'assistant';
  content: string;
  intencao?: string;
  score?: number;
  handoff?: boolean;
};

export default function BaseConhecimentoPage() {
  const [kb, setKb] = useState<BaseConhecimento | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [historico, setHistorico] = useState<BaseConhecimento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alterado, setAlterado] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErro, setUploadErro] = useState('');
  const [docNome, setDocNome] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Simulação (testar a KB em edição sem afetar leads reais)
  const [testeAberto, setTesteAberto] = useState(false);
  const [testeHistorico, setTesteHistorico] = useState<MensagemTeste[]>([]);
  const [testeQualificacao, setTesteQualificacao] = useState<Record<string, unknown>>({});
  const [testeInput, setTesteInput] = useState('');
  const [testeCarregando, setTesteCarregando] = useState(false);
  const [testeErro, setTesteErro] = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data: ativa } = await supabase
      .from('base_conhecimento')
      .select('*')
      .eq('ativa', true)
      .single();

    const { data: hist } = await supabase
      .from('base_conhecimento')
      .select('*')
      .order('versao', { ascending: false })
      .limit(10);

    if (ativa) {
      setKb(ativa);
      setConteudo(ativa.conteudo);
    }
    setHistorico(hist ?? []);
    setLoading(false);
    setAlterado(false);
  }

  async function salvar() {
    if (!conteudo.trim()) return;
    setSalvando(true);

    const novaVersao = (kb?.versao ?? 0) + 1;

    if (kb) {
      await supabase.from('base_conhecimento').update({ ativa: false }).eq('id', kb.id);
    }

    const { data: nova } = await supabase
      .from('base_conhecimento')
      .insert({ versao: novaVersao, conteudo: conteudo.trim(), ativa: true })
      .select()
      .single();

    if (nova) {
      setKb(nova);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    }

    setSalvando(false);
    setAlterado(false);
    carregar();
  }

  function restaurar(versao: BaseConhecimento) {
    confirm({
      title: 'Restaurar versão',
      description: `Restaurar versão ${versao.versao}? Isso criará uma nova versão com o conteúdo anterior.`,
      confirmLabel: 'Restaurar',
      onConfirm: () => {
        setConteudo(versao.conteudo);
        setAlterado(true);
      },
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadErro('');
    setDocNome(file.name);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'txt' || ext === 'md') {
        // Lê direto como texto
        const texto = await file.text();
        const separador = conteudo.trim()
          ? `\n\n---\n# 📄 Importado de: ${file.name}\n\n`
          : `# 📄 Importado de: ${file.name}\n\n`;
        setConteudo(prev => prev + separador + texto);
        setAlterado(true);

      } else if (ext === 'pdf') {
        // Extração via Gemini (mesma IA já usada no resto do app)
        const fd = new FormData();
        fd.append('file', file);
        const resp = await fetch('/api/base-conhecimento/extrair-pdf', { method: 'POST', body: fd });
        const data = await resp.json();

        if (!resp.ok) {
          setUploadErro(data?.error ?? 'Erro ao extrair texto do PDF.');
        } else {
          const separador = conteudo.trim()
            ? `\n\n---\n# 📄 Importado de: ${file.name}\n\n`
            : `# 📄 Importado de: ${file.name}\n\n`;
          setConteudo(prev => prev + separador + data.texto);
          setAlterado(true);
        }

      } else {
        setUploadErro('Formato não suportado. Use PDF, TXT ou MD.');
      }
    } catch {
      setUploadErro('Erro ao processar o arquivo. Tente novamente.');
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function enviarTeste() {
    const texto = testeInput.trim();
    if (!texto || testeCarregando) return;

    const novoHistorico = [...testeHistorico, { role: 'user' as const, content: texto }];
    setTesteHistorico(novoHistorico);
    setTesteInput('');
    setTesteCarregando(true);
    setTesteErro('');

    try {
      const resp = await fetch('/api/base-conhecimento/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kb: conteudo,
          historico: novoHistorico.map(m => ({ role: m.role, content: m.content })),
          qualificacao_atual: testeQualificacao,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? 'Erro na simulação.');

      setTesteQualificacao(prev => ({ ...prev, ...data.dados_extraidos }));
      setTesteHistorico(h => [...h, {
        role: 'assistant',
        content: data.mensagem_para_cliente || '(sem mensagem — a IA classificou como spam/opt-out/outro consultor)',
        intencao: data.intencao_cliente,
        score: data.score,
        handoff: data.acionar_handoff,
      }]);
    } catch (e: unknown) {
      setTesteErro(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setTesteCarregando(false);
    }
  }

  function limparTeste() {
    setTesteHistorico([]);
    setTesteQualificacao({});
    setTesteErro('');
    setTesteInput('');
  }

  const chars = conteudo.length;
  const palavras = conteudo.trim() ? conteudo.trim().split(/\s+/).length : 0;
  const limiteMax = 100000;
  const percentual = Math.round((chars / limiteMax) * 100);

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-emerald-600" />
          <div>
            <h2 className="text-foreground font-semibold">Base de Conhecimento</h2>
            <p className="text-muted-foreground text-xs">
              Versão {kb?.versao ?? 1} · {formatarData(kb?.criada_em ?? new Date().toISOString())}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Botão testar */}
          <button
            onClick={() => setTesteAberto(true)}
            className="flex items-center gap-2 bg-violet-100 hover:bg-violet-200 text-violet-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            title="Simular uma conversa com esta KB antes de publicar"
          >
            <MessageSquare size={15} />
            Testar com IA
          </button>

          {/* Botão upload */}
          <label className="flex items-center gap-2 bg-muted hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            <Upload size={15} />
            {uploading ? 'Processando...' : 'Importar documento'}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>

          {salvo && (
            <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
              <CheckCircle size={14} />
              Salvo
            </div>
          )}
          <button
            onClick={salvar}
            disabled={salvando || !alterado}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={15} />
            {salvando ? 'Salvando...' : 'Salvar nova versão'}
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alterado && (
        <div className="px-8 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-xs">
          ⚠ Alterações não salvas — clique em &quot;Salvar nova versão&quot; para publicar.
        </div>
      )}
      {uploadErro && (
        <div className="px-8 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>❌ {uploadErro}</span>
          <button onClick={() => setUploadErro('')}><X size={12} /></button>
        </div>
      )}
      {uploading && (
        <div className="px-8 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-xs flex items-center gap-2">
          <FileText size={12} className="animate-pulse" />
          Extraindo texto de {docNome}...
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <textarea
            value={conteudo}
            onChange={e => { setConteudo(e.target.value); setAlterado(true); }}
            className="flex-1 bg-background text-foreground text-sm font-mono p-6 resize-none focus:outline-none leading-relaxed"
            placeholder="Escreva aqui o documento que vai treinar o Maikon, ou importe um PDF/TXT..."
            spellCheck={false}
          />
          <div className="px-6 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{palavras} palavras · {chars.toLocaleString('pt-BR')} caracteres</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${percentual > 80 ? 'bg-yellow-500' : 'bg-emerald-600'}`}
                  style={{ width: `${Math.min(100, percentual)}%` }}
                />
              </div>
              <span>{percentual}% do limite</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l border-border flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-border">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Formatos suportados</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>📄 <strong className="text-muted-foreground">PDF</strong> — extração automática via IA</li>
              <li>📝 <strong className="text-muted-foreground">TXT / MD</strong> — importação direta</li>
              <li className="pt-1 border-t border-border">O conteúdo é adicionado ao final do texto atual</li>
            </ul>
          </div>

          <div className="p-5 border-b border-border">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Dicas</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>Use <code className="text-muted-foreground bg-muted px-1 rounded"># Título</code> para organizar seções</li>
              <li>Defina claramente o tom e o que o Maikon NUNCA deve fazer</li>
              <li>Inclua as principais objeções e como responder</li>
              <li>Atualize sempre que lançar uma nova campanha</li>
            </ul>
          </div>

          <div className="p-5">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Versões anteriores</p>
            {historico.filter(h => !h.ativa).length === 0 ? (
              <p className="text-muted-foreground text-xs">Nenhum histórico ainda.</p>
            ) : (
              <div className="space-y-2">
                {historico.filter(h => !h.ativa).map(h => (
                  <div key={h.id} className="bg-muted/60 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground text-xs font-medium">v{h.versao}</span>
                      <button
                        onClick={() => restaurar(h)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-emerald-600 text-xs transition-colors"
                      >
                        <RotateCcw size={11} /> Restaurar
                      </button>
                    </div>
                    <p className="text-muted-foreground text-xs">{formatarData(h.criada_em)}</p>
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{h.conteudo.slice(0, 80)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {testeAberto && (
        <div className="fixed inset-0 bg-black/40 z-[90] flex justify-end" onClick={() => setTesteAberto(false)}>
          <div
            className="w-full max-w-md h-full bg-card border-l border-border flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div>
                <h3 className="text-foreground font-semibold flex items-center gap-2">
                  <Bot size={17} className="text-violet-600" /> Simulação — Maikon IA
                </h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Usa o texto atual do editor, mesmo sem salvar. Não afeta leads reais.
                </p>
              </div>
              <button onClick={() => setTesteAberto(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {testeHistorico.length === 0 && (
                <p className="text-muted-foreground text-xs text-center mt-8">
                  Manda uma mensagem como se fosse um lead pra ver como o Maikon responderia com esta KB.
                </p>
              )}
              {testeHistorico.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === 'assistant' && (m.intencao || m.score !== undefined) && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50 flex-wrap">
                        {m.intencao && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            m.intencao === 'QUALIFICACAO'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {m.intencao}
                          </span>
                        )}
                        {m.score !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            score {m.score}
                          </span>
                        )}
                        {m.handoff && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700 border border-yellow-500/20 flex items-center gap-1">
                            <Flame size={9} /> handoff
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {testeCarregando && (
                <div className="flex justify-start">
                  <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm">
                    digitando...
                  </div>
                </div>
              )}
            </div>

            {testeErro && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-600 text-xs">{testeErro}</div>
            )}

            <div className="p-3 border-t border-border flex items-center gap-2">
              <button
                onClick={limparTeste}
                disabled={testeHistorico.length === 0}
                className="p-2 text-muted-foreground hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Limpar conversa"
              >
                <Trash2 size={16} />
              </button>
              <input
                type="text"
                value={testeInput}
                onChange={e => setTesteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTeste(); } }}
                placeholder="Simula uma mensagem do lead..."
                disabled={testeCarregando}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
              />
              <button
                onClick={enviarTeste}
                disabled={testeCarregando || !testeInput.trim()}
                className="p-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}