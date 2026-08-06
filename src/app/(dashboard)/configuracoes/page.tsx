'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { contarCombinacoesSpintax } from '@/lib/utils';
import { HexBadge, HexDot, HexIcon } from '@/components/ui/hex';
import { Button } from '@/components/ui/button';
import { Settings, Save, CheckCircle, Plus, Trash2, Eye, EyeOff, AlertTriangle, Sparkles, Pencil, X } from 'lucide-react';
import { useConfirm } from '@/hooks/use-confirm';

type Template = {
  id: string;
  nome: string;
  corpo: string;
  ativo: boolean;
  taxa_resposta: number | null;
  criado_em: string;
};

export default function ConfiguracoesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvo, setSalvo] = useState('');

  // Form novo template
  const [novoNome, setNovoNome] = useState('');
  const [novoCorpo, setNovoCorpo] = useState('');
  const [criando, setCriando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [gerandoNovo, setGerandoNovo] = useState(false);
  const [erroGerarNovo, setErroGerarNovo] = useState('');

  // Edição de template existente
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicaoCorpo, setEdicaoCorpo] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [gerandoEdicao, setGerandoEdicao] = useState(false);
  const [erroGerarEdicao, setErroGerarEdicao] = useState('');
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Configurações Evolution
  const [evoUrl] = useState('https://evo.feravre.com');
  const [evoInstancia] = useState('TechXap - ConsorHive');
  const [mostrarKey, setMostrarKey] = useState(false);

  useEffect(() => { carregarTemplates(); }, []);

  async function carregarTemplates() {
    setLoading(true);
    const { data } = await supabase.from('templates_mensagem').select('*').order('criado_em', { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  }

  async function criarTemplate() {
    if (!novoNome.trim() || !novoCorpo.trim()) return;
    setCriando(true);
    await supabase.from('templates_mensagem').insert({ nome: novoNome.trim(), corpo: novoCorpo.trim(), ativo: true });
    setNovoNome('');
    setNovoCorpo('');
    setMostrarForm(false);
    setSalvo('Template criado!');
    setTimeout(() => setSalvo(''), 3000);
    carregarTemplates();
    setCriando(false);
  }

  async function toggleTemplate(id: string, ativo: boolean) {
    await supabase.from('templates_mensagem').update({ ativo: !ativo }).eq('id', id);
    carregarTemplates();
  }

  function deletarTemplate(id: string) {
    confirm({
      title: 'Deletar template',
      description: 'Deletar este template? Campanhas já criadas com ele não são afetadas.',
      confirmLabel: 'Deletar',
      tone: 'danger',
      onConfirm: async () => {
        await supabase.from('templates_mensagem').delete().eq('id', id);
        carregarTemplates();
      },
    });
  }

  async function gerarVariacoesIA(corpo: string): Promise<string> {
    const resp = await fetch('/api/templates/variacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corpo }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error ?? 'Erro ao gerar variações.');
    return data.corpo as string;
  }

  async function gerarParaNovo() {
    if (!novoCorpo.trim()) return;
    setGerandoNovo(true);
    setErroGerarNovo('');
    try {
      setNovoCorpo(await gerarVariacoesIA(novoCorpo));
    } catch (e: unknown) {
      setErroGerarNovo(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setGerandoNovo(false);
    }
  }

  function abrirEdicao(t: Template) {
    setEditandoId(t.id);
    setEdicaoCorpo(t.corpo);
    setErroGerarEdicao('');
  }

  function fecharEdicao() {
    setEditandoId(null);
    setEdicaoCorpo('');
    setErroGerarEdicao('');
  }

  async function gerarParaEdicao() {
    if (!edicaoCorpo.trim()) return;
    setGerandoEdicao(true);
    setErroGerarEdicao('');
    try {
      setEdicaoCorpo(await gerarVariacoesIA(edicaoCorpo));
    } catch (e: unknown) {
      setErroGerarEdicao(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setGerandoEdicao(false);
    }
  }

  async function salvarEdicao(id: string) {
    if (!edicaoCorpo.trim()) return;
    setSalvandoEdicao(true);
    await supabase.from('templates_mensagem').update({ corpo: edicaoCorpo.trim() }).eq('id', id);
    setSalvandoEdicao(false);
    fecharEdicao();
    setSalvo('Template atualizado!');
    setTimeout(() => setSalvo(''), 3000);
    carregarTemplates();
  }

  const variaveis = ['{{nome}}', '{{empresa}}', '{{cidade}}'];

  return (
    <div className="bg-honeycomb relative min-h-full flex-1 space-y-8 overflow-y-auto p-8 pt-7">
      <div className="flex items-end justify-between border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Integrações e templates</p>
          <h2 className="font-heading mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-foreground">
            <HexIcon size="sm">
              <Settings size={14} className="text-primary" />
            </HexIcon>
            Configurações
          </h2>
        </div>
        {salvo && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-700 text-sm">
            <CheckCircle size={14} /> {salvo}
          </div>
        )}
      </div>

      {/* Seção Evolution */}
      <div className="card-hex-cut border border-border bg-card p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-1">Canal</p>
        <h3 className="text-foreground font-semibold mb-4">Integração WhatsApp (Evolution)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">URL da Evolution</label>
            <div className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              {evoUrl}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Instância</label>
            <div className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              {evoInstancia}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">API Key</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono">
                {mostrarKey ? '6416E80F51C6-4D75-9137-0741D124F130' : '••••••••••••••••••••••••••••••'}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setMostrarKey(!mostrarKey)}>
                {mostrarKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <HexDot pulse className="bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Conectado — TechXap - ConsorHive</span>
        </div>
      </div>

      {/* Seção Agente */}
      <div className="card-hex-cut border border-border bg-card p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-1">Automação</p>
        <h3 className="text-foreground font-semibold mb-4">Agente (Maikon)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">URL do Agente</label>
            <div className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono text-xs">
              https://n8n-evo-consorhive-agent.wbjptk.easypanel.host
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Modelo de IA</label>
            <div className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              Gemini 2.5 Pro
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Webhook de Disparo (n8n)</label>
            <div className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono text-xs">
              https://n8n-evo-n8n.wbjptk.easypanel.host/webhook/consorhive-disparo
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status do Agente</label>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
              <HexDot pulse className="bg-emerald-500" />
              <span className="text-foreground text-sm">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Templates */}
      <div className="card-hex-cut border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-1">Mensagens</p>
            <h3 className="text-foreground font-semibold">Templates de Mensagem</h3>
            <p className="text-muted-foreground text-xs mt-0.5">Mensagens usadas nas campanhas de prospecção</p>
          </div>
          <Button onClick={() => setMostrarForm(!mostrarForm)}>
            <Plus size={15} />
            Novo template
          </Button>
        </div>

        {/* Variáveis disponíveis */}
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Variáveis disponíveis:</span>
          {variaveis.map(v => (
            <code key={v} className="text-xs bg-muted text-emerald-600 px-2 py-0.5 rounded">{v}</code>
          ))}
        </div>
        <div className="mb-4 flex items-start gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Variação (spintax):</span>
          <code className="text-xs bg-muted text-emerald-600 px-2 py-0.5 rounded">{'{opção 1|opção 2|opção 3}'}</code>
          <span className="text-xs text-muted-foreground">
            — sorteia uma opção por envio. Use em várias partes da mensagem (saudação, corpo, despedida) pra cada
            contato receber um texto diferente. Mensagem igual pra números diferentes é o que costuma derrubar número em disparo.
          </span>
        </div>

        {/* Form novo template */}
        {mostrarForm && (
          <div className="mb-6 bg-muted/60 border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-foreground text-sm font-medium">Novo template</h4>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nome do template</label>
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex: Prospecção Imobiliária Junho"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Mensagem</label>
              <textarea
                value={novoCorpo}
                onChange={e => setNovoCorpo(e.target.value)}
                placeholder={'{Olá|Oi|E aí} {{nome}}, {tudo bem?|como vai?|beleza?}...'}
                rows={5}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary resize-none font-mono"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{novoCorpo.length} caracteres</p>
                {(() => {
                  const combinacoes = novoCorpo.trim() ? contarCombinacoesSpintax(novoCorpo) : 0;
                  if (combinacoes <= 1) {
                    return (
                      <p className="text-xs text-yellow-700 flex items-center gap-1">
                        <AlertTriangle size={12} /> Sem blocos {'{a|b|c}'} — mensagem sairá igual pra todo mundo
                      </p>
                    );
                  }
                  return <p className="text-xs text-emerald-600">≈ {combinacoes.toLocaleString('pt-BR')} combinações possíveis</p>;
                })()}
              </div>
              {erroGerarNovo && <p className="text-xs text-red-600 mt-1.5">{erroGerarNovo}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={criarTemplate} disabled={criando || !novoNome.trim() || !novoCorpo.trim()}>
                <Save size={14} />
                {criando ? 'Salvando...' : 'Salvar template'}
              </Button>
              <Button
                variant="outline"
                onClick={gerarParaNovo}
                disabled={gerandoNovo || !novoCorpo.trim()}
                title="Reescreve a mensagem com blocos de variação usando IA"
                className="border-secondary/25 text-secondary hover:border-secondary/50 hover:bg-secondary/5"
              >
                <Sparkles size={14} />
                {gerandoNovo ? 'Gerando...' : 'Gerar variações com IA'}
              </Button>
              <Button variant="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Lista de templates */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : templates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum template cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {templates.map(t => {
              const combinacoesAtuais = contarCombinacoesSpintax(t.corpo);
              const editando = editandoId === t.id;
              return (
                <div key={t.id} className={`border rounded-xl p-4 transition-colors ${t.ativo ? 'border-border bg-muted/50' : 'border-border bg-card opacity-50'}`}>
                  {!editando ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-foreground font-medium text-sm">{t.nome}</p>
                          {!t.ativo && <HexBadge className="bg-muted text-muted-foreground">Inativo</HexBadge>}
                          {t.taxa_resposta && (
                            <HexBadge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                              {t.taxa_resposta}% resposta
                            </HexBadge>
                          )}
                          {combinacoesAtuais <= 1 ? (
                            <HexBadge className="bg-yellow-500/10 text-yellow-700 border border-yellow-500/20">
                              <AlertTriangle size={11} /> sem variação
                            </HexBadge>
                          ) : (
                            <HexBadge className="bg-secondary/10 text-secondary border border-secondary/20">
                              ≈{combinacoesAtuais.toLocaleString('pt-BR')} variações
                            </HexBadge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs whitespace-pre-wrap line-clamp-3">{t.corpo}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon-xs" onClick={() => abrirEdicao(t)} title="Editar">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => toggleTemplate(t.id, t.ativo)} title={t.ativo ? 'Desativar' : 'Ativar'}>
                          {t.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => deletarTemplate(t.id)} className="hover:text-red-600">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-foreground text-sm font-medium">{t.nome}</p>
                        <button onClick={fecharEdicao} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                      <textarea
                        value={edicaoCorpo}
                        onChange={e => setEdicaoCorpo(e.target.value)}
                        rows={5}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary resize-none font-mono"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{edicaoCorpo.length} caracteres</p>
                        {(() => {
                          const combinacoes = edicaoCorpo.trim() ? contarCombinacoesSpintax(edicaoCorpo) : 0;
                          if (combinacoes <= 1) {
                            return (
                              <p className="text-xs text-yellow-700 flex items-center gap-1">
                                <AlertTriangle size={12} /> Sem blocos {'{a|b|c}'} — mensagem sairá igual pra todo mundo
                              </p>
                            );
                          }
                          return <p className="text-xs text-emerald-600">≈ {combinacoes.toLocaleString('pt-BR')} combinações possíveis</p>;
                        })()}
                      </div>
                      {erroGerarEdicao && <p className="text-xs text-red-600">{erroGerarEdicao}</p>}
                      <div className="flex gap-2">
                        <Button onClick={() => salvarEdicao(t.id)} disabled={salvandoEdicao || !edicaoCorpo.trim()}>
                          <Save size={14} />
                          {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={gerarParaEdicao}
                          disabled={gerandoEdicao || !edicaoCorpo.trim()}
                          title="Reescreve a mensagem com blocos de variação usando IA"
                          className="border-secondary/25 text-secondary hover:border-secondary/50 hover:bg-secondary/5"
                        >
                          <Sparkles size={14} />
                          {gerandoEdicao ? 'Gerando...' : 'Gerar variações com IA'}
                        </Button>
                        <Button variant="ghost" onClick={fecharEdicao}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}