'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, type BaseConhecimento } from '@/lib/supabase';
import { formatarData } from '@/lib/utils';
import { Save, RotateCcw, BookOpen, CheckCircle, Upload, FileText, X } from 'lucide-react';

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

  async function restaurar(versao: BaseConhecimento) {
    if (!confirm(`Restaurar versão ${versao.versao}? Isso criará uma nova versão com o conteúdo anterior.`)) return;
    setConteudo(versao.conteudo);
    setAlterado(true);
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
        // Usa API do Claude para extrair texto do PDF
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 4000,
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: base64 }
                  },
                  {
                    type: 'text',
                    text: 'Extraia todo o texto deste documento em formato markdown limpo, preservando a estrutura de títulos e parágrafos. Retorne APENAS o texto extraído, sem comentários.'
                  }
                ]
              }]
            })
          });

          const data = await response.json();
          const texto = data.content?.[0]?.text ?? '';
          const separador = conteudo.trim()
            ? `\n\n---\n# 📄 Importado de: ${file.name}\n\n`
            : `# 📄 Importado de: ${file.name}\n\n`;
          setConteudo(prev => prev + separador + texto);
          setAlterado(true);
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;

      } else {
        setUploadErro('Formato não suportado. Use PDF, TXT ou MD.');
      }
    } catch {
      setUploadErro('Erro ao processar o arquivo. Tente novamente.');
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
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
          ⚠ Alterações não salvas — clique em "Salvar nova versão" para publicar.
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
    </div>
  );
}