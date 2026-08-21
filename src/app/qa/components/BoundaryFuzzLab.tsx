'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldAlert, 
  Copy, 
  Check, 
  Flame, 
  Maximize2, 
  Code2, 
  Terminal,
  Type
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FuzzPayload {
  title: string;
  category: 'boundary' | 'unicode' | 'security' | 'whitespace';
  description: string;
  value: string;
}

const FUZZ_PAYLOADS: FuzzPayload[] = [
  // LÍMITE E TAMANHO
  { title: 'String Vazia', category: 'boundary', description: 'Testa campo nulo ou sem caracteres.', value: '' },
  { title: '1 Caractere (Mínimo)', category: 'boundary', description: 'Testa limite inferior de tamanho.', value: 'A' },
  { title: '255 Caracteres (Varchar Padrão)', category: 'boundary', description: 'Estouro de limite padrão de banco de dados.', value: 'A'.repeat(255) },
  { title: '1000 Caracteres (Texto Longo)', category: 'boundary', description: 'Testa campos de descrição e observação.', value: 'X'.repeat(1000) },

  // UNICODE & EMOJIS
  { title: 'Emojis & Multibyte UTF-8', category: 'unicode', description: 'Testa suporte a emojis de 4 bytes e UTF-8.', value: 'Olá Mundo 🌍 🚀 🩵 🚀 𝓤𝓷𝓲𝓬𝓸𝓭𝓮 𝒯𝑒𝓈𝓉 ﷽' },
  { title: 'Caracteres Especiais & RTL (Árabe/Hebraico)', category: 'unicode', description: 'Testa renderização Right-to-Left e acentuação.', value: 'مرحبا بالعالم - שלום עולם - ÉÀÔÇÃñ' },
  { title: 'Zalgo Text (Diacríticos Sobrepostos)', category: 'unicode', description: 'Testa se o layout quebra com diacríticos empilhados.', value: 'T̵e̸s̸t̸e̵ ̵Z̸a̷l̵g̵o̶ ̴Q̴A̵' },

  // ESPAÇOS E CARACTERES NULOS
  { title: 'Espaços no Início e Fim (Trim Test)', category: 'whitespace', description: 'Testa se o backend remove espaços nas pontas.', value: '   Texto com espaços nas bordas   ' },
  { title: 'Apenas Espaços em Branco', category: 'whitespace', description: 'Testa validação de campo obrigatório preenchido com espaços.', value: '     ' },
  { title: 'Quebras de Linha & Tabs (\\n \\t)', category: 'whitespace', description: 'Testa sanitização de quebras de linha e tabulações.', value: "Linha 1\nLinha 2\tCom Tab\r\nLinha 3" },

  // SEGURANÇA E FUZZING
  { title: 'Payload Básico de XSS', category: 'security', description: 'Testa sanitização de scripts injetados em campos de texto.', value: '<script>alert("XSS_QA_TEST")</script>' },
  { title: 'HTML Injection (Tags de Imagem)', category: 'security', description: 'Testa injeção de HTML no DOM.', value: '<img src="x" onerror="alert(\'XSS\')" />' },
  { title: 'Payload Básico de SQL Injection', category: 'security', description: 'Testa sanitização contra bypass de autenticação SQL.', value: "' OR '1'='1' --" },
  { title: 'Caracteres de Escape (&, ", \', <, >)', category: 'security', description: 'Testa se as aspas quebram a query ou o JSON.', value: `' " & < > % ; \` \\` },
];

export function BoundaryFuzzLab() {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const copyPayload = (value: string, idx: number) => {
    navigator.clipboard.writeText(value);
    setCopiedIndex(idx);
    toast({ title: 'Payload copiado!', description: 'Pronto para colagem no formulário ou API.' });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filtered = FUZZ_PAYLOADS.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6 w-full">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Laboratório de Testes de Fronteira & Fuzzing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Biblioteca de massa de dados para cenários de limite, caracteres especiais e validação de sanitização.
            </p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Input
            placeholder="Filtrar massa de teste..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs font-medium bg-slate-50 dark:bg-slate-950 w-full sm:w-56 h-9"
          />

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-3 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
          >
            <option value="all">Todas Categorias</option>
            <option value="boundary">Limite de Tamanho</option>
            <option value="unicode">Unicode & Emojis</option>
            <option value="whitespace">Espaços em Branco</option>
            <option value="security">Segurança (XSS/SQLi)</option>
          </select>
        </div>
      </div>

      {/* GRID DE PAYLOADS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item, idx) => (
          <Card key={idx} className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {item.category === 'security' && <ShieldAlert className="h-4 w-4 text-rose-500" />}
                  {item.category === 'unicode' && <Type className="h-4 w-4 text-purple-500" />}
                  {item.category === 'boundary' && <Maximize2 className="h-4 w-4 text-blue-500" />}
                  {item.category === 'whitespace' && <Code2 className="h-4 w-4 text-emerald-500" />}
                  {item.title}
                </h3>
                <Badge variant="outline" className="text-[9px] font-mono uppercase">
                  {item.value.length} chars
                </Badge>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                {item.description}
              </p>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 break-all max-h-24 overflow-y-auto scrollbar-thin">
                {item.value === '' ? <span className="italic text-slate-600">(String Vazia - 0 bytes)</span> : item.value}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => copyPayload(item.value, idx)}
              className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2 mt-2"
            >
              {copiedIndex === idx ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              Copiar Payload
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
