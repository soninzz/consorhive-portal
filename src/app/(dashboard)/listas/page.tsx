'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase, type Lista } from '@/lib/supabase';
import { normalizarTelefone, extrairDDD, formatarData } from '@/lib/utils';
import { Upload, List, Trash2, ArrowRight, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type ImportResult = {
  importados: number;
  invalidos: number;
  duplicados: number;
};

export default function ListasPage() {
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeLista, setNomeLista] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [colunaMap, setColunaMap] = useState<{ nome: string; telefone: string }>({ nome: '', telefone: '' });
  const [colunas, setColunas] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { carregarListas(); }, []);

  async function carregarListas() {
    setLoading(true);
    const { data } = await supabase.from('listas').select('*').order('criada_em', { ascending: false });
    setListas(data ?? []);
    setLoading(false);
  }

  function handleArquivo(file: File) {
    setArquivo(file);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        setColunas(cols);
        setPreview(rows.slice(0, 3));
        // Auto-detectar colunas comuns
        const nomeCol = cols.find(c => /nome|name/i.test(c)) ?? '';
        const telCol = cols.find(c => /tel|fone|celular|whatsapp|phone|numero/i.test(c)) ?? '';
        setColunaMap({ nome: nomeCol, telefone: telCol });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function importar() {
    if (!arquivo || !colunaMap.telefone || !nomeLista.trim()) return;
    setImportando(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      // Criar lista
      const { data: lista, error: erroLista } = await supabase
        .from('listas')
        .insert({ nome: nomeLista.trim(), origem: 'excel', total_contatos: 0 })
        .select()
        .single();

      if (erroLista || !lista) { setImportando(false); return; }

      let importados = 0, invalidos = 0, duplicados = 0;
      const batch: object[] = [];

      for (const row of rows.slice(0, 5000)) {
        const rawTel = String(row[colunaMap.telefone] ?? '');
        const telefone = normalizarTelefone(rawTel);
        if (!telefone) { invalidos++; continue; }

        const ddd = extrairDDD(telefone);
        batch.push({
          lista_id: lista.id,
          nome: colunaMap.nome ? (row[colunaMap.nome] ?? null) : null,
          telefone,
          ddd,
          empresa: row['empresa'] ?? row['Empresa'] ?? null,
          extra: Object.fromEntries(
            Object.entries(row).filter(([k]) => k !== colunaMap.nome && k !== colunaMap.telefone)
          ),
        });
      }

      // Inserir em chunks de 500
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const { error, count } = await supabase.from('contatos').insert(chunk, { count: 'exact' });
        if (error) {
          // Duplicados causam erro de unique constraint
          duplicados += chunk.length;
        } else {
          importados += count ?? chunk.length;
        }
      }

      // Atualizar total na lista
      await supabase.from('listas').update({ total_contatos: importados }).eq('id', lista.id);

      setResultado({ importados, invalidos, duplicados });
      setImportando(false);
      carregarListas();
    };
    reader.readAsArrayBuffer(arquivo);
  }

  function fecharModal() {
    setModalAberto(false);
    setNomeLista('');
    setArquivo(null);
    setColunas([]);
    setPreview([]);
    setColunaMap({ nome: '', telefone: '' });
    setResultado(null);
  }

  async function excluirLista(id: string) {
    if (!confirm('Excluir esta lista e todos os seus contatos?')) return;
    await supabase.from('listas').delete().eq('id', id);
    carregarListas();
  }

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Listas de Contatos</h2>
          <p className="text-slate-400 text-sm mt-1">Importe suas listas para iniciar campanhas de prospecção.</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Upload size={16} />
          Importar Lista
        </button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-slate-500 text-sm">Carregando listas...</div>
      ) : listas.length === 0 ? (
        <div className="border border-dashed border-slate-700 rounded-xl p-16 text-center">
          <List size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Nenhuma lista ainda</p>
          <p className="text-slate-600 text-sm mt-1">Importe um arquivo Excel ou CSV para começar.</p>
          <button
            onClick={() => setModalAberto(true)}
            className="mt-4 text-emerald-400 text-sm hover:text-emerald-300"
          >
            Importar agora →
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Nome</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Origem</th>
                <th className="text-right px-6 py-3 text-slate-400 font-medium">Contatos</th>
                <th className="text-right px-6 py-3 text-slate-400 font-medium">Contactados</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Criada em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {listas.map((lista) => (
                <tr key={lista.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-slate-200 font-medium">{lista.nome}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded capitalize">{lista.origem}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300">
                    <span className="flex items-center justify-end gap-1">
                      <Users size={14} className="text-slate-500" />
                      {lista.total_contatos.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">
                    {lista.contactados > 0 ? (
                      <span className="text-emerald-400">{lista.contactados}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatarData(lista.criada_em)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/campanhas/nova?lista=${lista.id}`}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Usar em campanha <ArrowRight size={12} />
                      </a>
                      <button
                        onClick={() => excluirLista(lista.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Importação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-slate-50">Importar Lista</h3>
              <p className="text-slate-400 text-sm mt-1">Suporta .xlsx e .csv. Máximo 5.000 contatos.</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome da lista</label>
                <input
                  type="text"
                  value={nomeLista}
                  onChange={e => setNomeLista(e.target.value)}
                  placeholder="Ex: Imobiliárias Floripa — Jun/26"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Arquivo</label>
                {!arquivo ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-600 transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-slate-400 text-sm">Clique para selecionar o arquivo</p>
                    <p className="text-slate-600 text-xs mt-1">.xlsx ou .csv</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.csv,.xls"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleArquivo(e.target.files[0])}
                    />
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-slate-300 text-sm">{arquivo.name}</span>
                    <button onClick={() => { setArquivo(null); setColunas([]); setPreview([]); }} className="text-slate-500 hover:text-red-400 text-xs">Remover</button>
                  </div>
                )}
              </div>

              {/* Mapeamento de colunas */}
              {colunas.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-300">Mapear colunas</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Coluna do Nome</label>
                      <select
                        value={colunaMap.nome}
                        onChange={e => setColunaMap(p => ({ ...p, nome: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">(opcional)</option>
                        {colunas.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Coluna do Telefone *</label>
                      <select
                        value={colunaMap.telefone}
                        onChange={e => setColunaMap(p => ({ ...p, telefone: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Selecione...</option>
                        {colunas.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Preview */}
                  {preview.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
                      <p className="text-xs text-slate-500 mb-2">Preview (3 primeiras linhas)</p>
                      <table className="text-xs w-full">
                        <thead>
                          <tr>{colunas.slice(0, 4).map(c => <th key={c} className="text-left pr-4 text-slate-500 pb-1">{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i}>
                              {colunas.slice(0, 4).map(c => (
                                <td key={c} className="pr-4 text-slate-400 pb-1 truncate max-w-[120px]">{row[c]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado */}
              {resultado && (
                <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-200 mb-3">Importação concluída</p>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span className="text-slate-300">{resultado.importados} contatos importados</span>
                  </div>
                  {resultado.invalidos > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle size={16} className="text-red-400" />
                      <span className="text-slate-400">{resultado.invalidos} telefones inválidos ignorados</span>
                    </div>
                  )}
                  {resultado.duplicados > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle size={16} className="text-yellow-400" />
                      <span className="text-slate-400">{resultado.duplicados} duplicados ignorados</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={fecharModal} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                {resultado ? 'Fechar' : 'Cancelar'}
              </button>
              {!resultado && (
                <button
                  onClick={importar}
                  disabled={!arquivo || !colunaMap.telefone || !nomeLista.trim() || importando}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {importando ? 'Importando...' : 'Importar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}