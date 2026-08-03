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
          <h2 className="text-2xl font-bold text-foreground">Listas de Contatos</h2>
          <p className="text-muted-foreground text-sm mt-1">Importe suas listas para iniciar campanhas de prospecção.</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Upload size={16} />
          Importar Lista
        </button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando listas...</div>
      ) : listas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center">
          <List size={40} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma lista ainda</p>
          <p className="text-muted-foreground text-sm mt-1">Importe um arquivo Excel ou CSV para começar.</p>
          <button
            onClick={() => setModalAberto(true)}
            className="mt-4 text-emerald-600 text-sm hover:text-emerald-700"
          >
            Importar agora →
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Origem</th>
                <th className="text-right px-6 py-3 text-muted-foreground font-medium">Contatos</th>
                <th className="text-right px-6 py-3 text-muted-foreground font-medium">Contactados</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Criada em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {listas.map((lista) => (
                <tr key={lista.id} className="border-b border-border/60 hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 text-foreground font-medium">{lista.nome}</td>
                  <td className="px-6 py-4">
                    <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded capitalize">{lista.origem}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-foreground">
                    <span className="flex items-center justify-end gap-1">
                      <Users size={14} className="text-muted-foreground" />
                      {lista.total_contatos.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    {lista.contactados > 0 ? (
                      <span className="text-emerald-600">{lista.contactados}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatarData(lista.criada_em)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/campanhas/nova?lista=${lista.id}`}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        Usar em campanha <ArrowRight size={12} />
                      </a>
                      <button
                        onClick={() => excluirLista(lista.id)}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
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
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Importar Lista</h3>
              <p className="text-muted-foreground text-sm mt-1">Suporta .xlsx e .csv. Máximo 5.000 contatos.</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome da lista</label>
                <input
                  type="text"
                  value={nomeLista}
                  onChange={e => setNomeLista(e.target.value)}
                  placeholder="Ex: Imobiliárias Floripa — Jun/26"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Arquivo</label>
                {!arquivo ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-emerald-600 transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-sm">Clique para selecionar o arquivo</p>
                    <p className="text-muted-foreground text-xs mt-1">.xlsx ou .csv</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.csv,.xls"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleArquivo(e.target.files[0])}
                    />
                  </div>
                ) : (
                  <div className="bg-muted border border-border rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-foreground text-sm">{arquivo.name}</span>
                    <button onClick={() => { setArquivo(null); setColunas([]); setPreview([]); }} className="text-muted-foreground hover:text-red-600 text-xs">Remover</button>
                  </div>
                )}
              </div>

              {/* Mapeamento de colunas */}
              {colunas.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Mapear colunas</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Coluna do Nome</label>
                      <select
                        value={colunaMap.nome}
                        onChange={e => setColunaMap(p => ({ ...p, nome: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="">(opcional)</option>
                        {colunas.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Coluna do Telefone *</label>
                      <select
                        value={colunaMap.telefone}
                        onChange={e => setColunaMap(p => ({ ...p, telefone: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="">Selecione...</option>
                        {colunas.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Preview */}
                  {preview.length > 0 && (
                    <div className="bg-muted/60 rounded-lg p-3 overflow-x-auto">
                      <p className="text-xs text-muted-foreground mb-2">Preview (3 primeiras linhas)</p>
                      <table className="text-xs w-full">
                        <thead>
                          <tr>{colunas.slice(0, 4).map(c => <th key={c} className="text-left pr-4 text-muted-foreground pb-1">{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i}>
                              {colunas.slice(0, 4).map(c => (
                                <td key={c} className="pr-4 text-muted-foreground pb-1 truncate max-w-[120px]">{row[c]}</td>
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
                <div className="bg-muted rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground mb-3">Importação concluída</p>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <span className="text-foreground">{resultado.importados} contatos importados</span>
                  </div>
                  {resultado.invalidos > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle size={16} className="text-red-600" />
                      <span className="text-muted-foreground">{resultado.invalidos} telefones inválidos ignorados</span>
                    </div>
                  )}
                  {resultado.duplicados > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle size={16} className="text-yellow-700" />
                      <span className="text-muted-foreground">{resultado.duplicados} duplicados ignorados</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button onClick={fecharModal} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {resultado ? 'Fechar' : 'Cancelar'}
              </button>
              {!resultado && (
                <button
                  onClick={importar}
                  disabled={!arquivo || !colunaMap.telefone || !nomeLista.trim() || importando}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium rounded-lg transition-colors"
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