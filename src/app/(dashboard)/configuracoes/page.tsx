'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, CheckCircle, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

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

  async function deletarTemplate(id: string) {
    if (!confirm('Deletar este template?')) return;
    await supabase.from('templates_mensagem').delete().eq('id', id);
    carregarTemplates();
  }

  const variaveis = ['{{nome}}', '{{empresa}}', '{{cidade}}'];

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-emerald-500" />
          <h2 className="text-2xl font-bold text-slate-50">Configurações</h2>
        </div>
        {salvo && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <CheckCircle size={14} /> {salvo}
          </div>
        )}
      </div>

      {/* Seção Evolution */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-slate-200 font-semibold mb-4">Integração WhatsApp (Evolution)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">URL da Evolution</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
              {evoUrl}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Instância</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
              {evoInstancia}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">API Key</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm font-mono">
                {mostrarKey ? '6416E80F51C6-4D75-9137-0741D124F130' : '••••••••••••••••••••••••••••••'}
              </div>
              <button onClick={() => setMostrarKey(!mostrarKey)} className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
                {mostrarKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-xs text-slate-400">Conectado — TechXap - ConsorHive</span>
        </div>
      </div>

      {/* Seção Agente */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-slate-200 font-semibold mb-4">Agente (Bianca)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">URL do Agente</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm font-mono text-xs">
              https://n8n-evo-consorhive-agent.wbjptk.easypanel.host
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Modelo de IA</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
              Gemini 2.5 Pro
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Webhook de Disparo (n8n)</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm font-mono text-xs">
              https://n8n-evo-n8n.wbjptk.easypanel.host/webhook/consorhive-disparo
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status do Agente</label>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-slate-300 text-sm">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Templates */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-slate-200 font-semibold">Templates de Mensagem</h3>
            <p className="text-slate-500 text-xs mt-0.5">Mensagens usadas nas campanhas de prospecção</p>
          </div>
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Novo template
          </button>
        </div>

        {/* Variáveis disponíveis */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Variáveis disponíveis:</span>
          {variaveis.map(v => (
            <code key={v} className="text-xs bg-slate-800 text-emerald-400 px-2 py-0.5 rounded">{v}</code>
          ))}
        </div>

        {/* Form novo template */}
        {mostrarForm && (
          <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
            <h4 className="text-slate-300 text-sm font-medium">Novo template</h4>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nome do template</label>
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex: Prospecção Imobiliária Junho"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Mensagem</label>
              <textarea
                value={novoCorpo}
                onChange={e => setNovoCorpo(e.target.value)}
                placeholder="Olá {{nome}}, tudo bem?..."
                rows={5}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none font-mono"
              />
              <p className="text-xs text-slate-600 mt-1">{novoCorpo.length} caracteres</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={criarTemplate}
                disabled={criando || !novoNome.trim() || !novoCorpo.trim()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Save size={14} />
                {criando ? 'Salvando...' : 'Salvar template'}
              </button>
              <button onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de templates */}
        {loading ? (
          <p className="text-slate-500 text-sm">Carregando...</p>
        ) : templates.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum template cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className={`border rounded-xl p-4 transition-colors ${t.ativo ? 'border-slate-700 bg-slate-800/30' : 'border-slate-800 bg-slate-900 opacity-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-slate-200 font-medium text-sm">{t.nome}</p>
                      {!t.ativo && <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Inativo</span>}
                      {t.taxa_resposta && (
                        <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/30 px-1.5 py-0.5 rounded">
                          {t.taxa_resposta}% resposta
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs whitespace-pre-wrap line-clamp-3">{t.corpo}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleTemplate(t.id, t.ativo)}
                      className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs"
                      title={t.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {t.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => deletarTemplate(t.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}