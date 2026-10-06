'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight, Baseline, CaseUpper, FileCode, FlipHorizontal, Hash, Info, ListFilter, Scissors,
  SortAsc, Sparkles, Type, Wand2, WholeWord,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';
import { applyTool, textStats, type ToolId } from './transforms';

interface ToolDef { id: ToolId; label: string; icon: LucideIcon }

const GROUPS: { title: string; tools: ToolDef[] }[] = [
  {
    title: 'Básico',
    tools: [
      { id: 'uppercase', label: 'MAIÚSCULAS', icon: CaseUpper },
      { id: 'lowercase', label: 'minúsculas', icon: Baseline },
      { id: 'capitalize', label: 'Capitalizar', icon: Type },
    ],
  },
  {
    title: 'Convenções de nome',
    tools: [
      { id: 'camel', label: 'camelCase', icon: Type },
      { id: 'pascal', label: 'PascalCase', icon: Type },
      { id: 'snake', label: 'snake_case', icon: Type },
      { id: 'kebab', label: 'kebab-case / slug', icon: Type },
    ],
  },
  {
    title: 'Formatação',
    tools: [
      { id: 'sort', label: 'Ordem alfabética', icon: SortAsc },
      { id: 'unique', label: 'Remover linhas repetidas', icon: ListFilter },
      { id: 'trim_lines', label: 'Aparar linhas / remover vazias', icon: ListFilter },
      { id: 'reverse', label: 'Inverter texto', icon: FlipHorizontal },
      { id: 'remove_accents', label: 'Remover acentos', icon: Sparkles },
      { id: 'remove_newlines', label: 'Remover quebras de linha', icon: ListFilter },
    ],
  },
  {
    title: 'Conversão',
    tools: [
      { id: 'text_to_html', label: 'Texto para HTML', icon: FileCode },
      { id: 'extenso', label: 'Número por extenso', icon: Hash },
      { id: 'stylized', label: 'Letras estilizadas', icon: Wand2 },
    ],
  },
  {
    title: 'Análise e corte',
    tools: [
      { id: 'char_info', label: 'Info de caracteres', icon: Info },
      { id: 'occurrence', label: 'Contar ocorrências', icon: WholeWord },
      { id: 'cut', label: 'Cortar no limite', icon: Scissors },
      { id: 'split', label: 'Dividir por delimitador', icon: ArrowLeftRight },
    ],
  },
];

const SAMPLE = 'Reunião de Planejamento da Sprint 42\nrevisão do backlog do projeto DDWMISSI\nReunião de Planejamento da Sprint 42';

export default function StringMasterPage() {
  const [input, setInput] = useState('');
  const [tool, setTool] = useState<ToolId | null>(null);
  const [delimiter, setDelimiter] = useState(',');
  const [limit, setLimit] = useState(100);
  const [word, setWord] = useState('');

  const stats = useMemo(() => textStats(input), [input]);
  // O resultado é derivado: muda ao editar o texto ou os parâmetros da ferramenta ativa.
  const output = useMemo(() => (tool ? applyTool(tool, input, { delimiter, limit, word }) : ''), [tool, input, delimiter, limit, word]);
  const toolLabel = GROUPS.flatMap(g => g.tools).find(t => t.id === tool)?.label;

  return (
    <DevToolPage
      toolId="string-master"
      actions={
        <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE)} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[260px_1fr_1fr] md:gap-4">
        {/* Caixa de ferramentas */}
        <aside className="flex max-h-56 min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:max-h-none">
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Caixa de ferramentas</h2>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {GROUPS.map(g => (
              <div key={g.title} className="space-y-1">
                <p className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{g.title}</p>
                {g.tools.map(t => (
                  <div key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTool(t.id)}
                      aria-pressed={tool === t.id}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors',
                        tool === t.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.label}
                    </button>
                    {/* Parâmetro da ferramenta, visível só quando ela está ativa */}
                    {tool === t.id && t.id === 'split' && (
                      <Input value={delimiter} onChange={e => setDelimiter(e.target.value)} placeholder="Delimitador (ex.: ,)" aria-label="Delimitador" className="mt-1 h-8 rounded-lg font-code text-xs" />
                    )}
                    {tool === t.id && t.id === 'cut' && (
                      <Input type="number" min={1} value={limit} onChange={e => setLimit(Number(e.target.value))} aria-label="Limite de caracteres" className="mt-1 h-8 rounded-lg font-code text-xs" />
                    )}
                    {tool === t.id && t.id === 'occurrence' && (
                      <Input value={word} onChange={e => setWord(e.target.value)} placeholder="Palavra a contar" aria-label="Palavra" className="mt-1 h-8 rounded-lg text-xs" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <ToolPane
          title="Texto original"
          value={input}
          onChange={v => setInput(v)}
          placeholder="Cole seu texto aqui…"
          footer={`${stats.words} palavras · ${stats.chars} caracteres (${stats.charsNoSpace} sem espaços) · ${stats.lines} linhas · ${stats.paragraphs} parágrafos`}
        />
        <ToolPane
          title={toolLabel ? `Resultado — ${toolLabel}` : 'Resultado'}
          value={output}
          readOnly
          placeholder="Escolha uma ferramenta na caixa ao lado."
          downloadName="resultado.txt"
          footer={output ? `${output.length} caracteres` : undefined}
        />
      </div>
    </DevToolPage>
  );
}
