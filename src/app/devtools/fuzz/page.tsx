'use client';

import { useMemo, useState } from 'react';
import { Check, Code2, Copy, Maximize2, Search, ShieldAlert, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { useToast } from '@/hooks/use-toast';

type Category = 'boundary' | 'unicode' | 'security' | 'whitespace';

interface FuzzPayload {
  title: string;
  category: Category;
  description: string;
  value: string;
}

const FUZZ_PAYLOADS: FuzzPayload[] = [
  // LIMITE E TAMANHO
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
  { title: 'Quebras de Linha & Tabs (\\n \\t)', category: 'whitespace', description: 'Testa sanitização de quebras de linha e tabulações.', value: 'Linha 1\nLinha 2\tCom Tab\r\nLinha 3' },

  // SEGURANÇA E FUZZING
  { title: 'Payload Básico de XSS', category: 'security', description: 'Testa sanitização de scripts injetados em campos de texto.', value: '<script>alert("XSS_QA_TEST")</script>' },
  { title: 'HTML Injection (Tags de Imagem)', category: 'security', description: 'Testa injeção de HTML no DOM.', value: '<img src="x" onerror="alert(\'XSS\')" />' },
  { title: 'Payload Básico de SQL Injection', category: 'security', description: 'Testa sanitização contra bypass de autenticação SQL.', value: "' OR '1'='1' --" },
  { title: 'Caracteres de Escape (&, ", \', <, >)', category: 'security', description: 'Testa se as aspas quebram a query ou o JSON.', value: `' " & < > % ; \` \\` },
];

const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'boundary', label: 'Limite' },
  { id: 'unicode', label: 'Unicode' },
  { id: 'whitespace', label: 'Espaços' },
  { id: 'security', label: 'Segurança' },
];

const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  boundary: Maximize2,
  unicode: Type,
  whitespace: Code2,
  security: ShieldAlert,
};

export default function FuzzPage() {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FUZZ_PAYLOADS.map((p, index) => ({ p, index })).filter(({ p }) => {
      const matchSearch = p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchSearch && (category === 'all' || p.category === category);
    });
  }, [search, category]);

  const copyPayload = async (value: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(idx);
      toast({ title: 'Payload copiado', description: 'Pronto para colar no formulário ou na API.' });
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  return (
    <DevToolPage toolId="fuzz">
      <div className="flex h-full flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar massa de teste…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 rounded-lg pl-8 text-xs font-medium"
            />
          </div>
          <Tabs value={category} onValueChange={v => setCategory(v as Category | 'all')}>
            <TabsList className="h-9 rounded-xl p-0.5">
              {CATEGORIES.map(c => (
                <TabsTrigger key={c.id} value={c.id} className="h-8 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wider">{c.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-muted-foreground">Nenhum payload encontrado para esse filtro.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(({ p, index }) => {
                const Icon = CATEGORY_ICON[p.category];
                return (
                  <article key={index} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="flex items-center gap-2 font-headline text-xs font-black uppercase tracking-tight text-foreground">
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          {p.title}
                        </h3>
                        <Badge variant="outline" className="shrink-0 rounded-full font-code text-[10px]">{p.value.length} chars</Badge>
                      </div>
                      <p className="text-xs font-medium leading-relaxed text-muted-foreground">{p.description}</p>
                      <div className="custom-scrollbar max-h-24 overflow-y-auto break-all rounded-xl border border-border bg-muted p-3 font-code text-xs text-foreground">
                        {p.value === '' ? <span className="italic text-muted-foreground">(string vazia, 0 bytes)</span> : p.value}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => copyPayload(p.value, index)} className="h-9 w-full gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      {copiedIndex === index ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      Copiar payload
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DevToolPage>
  );
}
