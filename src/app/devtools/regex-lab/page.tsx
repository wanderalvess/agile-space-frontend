'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';

interface RegexMatch {
  index: number;
  content: string;
  groups: (string | undefined)[];
}

const MAX_MATCHES = 1000; // evita travar a aba com padrões que casam em todo caractere

const FLAG_OPTIONS: { flag: string; hint: string }[] = [
  { flag: 'g', hint: 'Global: todas as ocorrências' },
  { flag: 'i', hint: 'Ignorar maiúsculas/minúsculas' },
  { flag: 'm', hint: 'Multilinha: ^ e $ por linha' },
  { flag: 's', hint: 'Ponto casa quebra de linha' },
  { flag: 'u', hint: 'Unicode' },
];

const CHEATS: [string, string][] = [
  ['\\d', 'dígito'], ['\\w', 'letra/dígito/_'], ['\\s', 'espaço'], ['.', 'qualquer caractere'],
  ['+', '1 ou mais'], ['*', '0 ou mais'], ['?', 'opcional'], ['^ $', 'início / fim'],
  ['( )', 'grupo de captura'], ['[a-z]', 'classe'], ['a|b', 'a ou b'], ['{2,4}', 'repetição'],
];

// Executa a regex e devolve os matches (lógica do legado, com limite de segurança).
function runRegex(pattern: string, flags: string, text: string): { matches: RegexMatch[]; error: string | null } {
  if (!pattern) return { matches: [], error: null };
  try {
    const regex = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];
    if (flags.includes('g')) {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null && matches.length < MAX_MATCHES) {
        matches.push({ index: m.index, content: m[0], groups: m.slice(1) });
        // match vazio não avança lastIndex sozinho: evita laço infinito
        if (m.index === regex.lastIndex) regex.lastIndex++;
      }
    } else {
      const m = regex.exec(text);
      if (m) matches.push({ index: m.index, content: m[0], groups: m.slice(1) });
    }
    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : 'Expressão inválida' };
  }
}

export default function RegexLabPage() {
  const [pattern, setPattern] = useState('[a-zA-Z0-9]+');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('Exemplo de Regex 123!');

  const { matches, error } = useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);

  const toggleFlag = (f: string) => setFlags(cur => (cur.includes(f) ? cur.replace(f, '') : cur + f));

  // Texto com os trechos casados destacados (matches vazios são ignorados).
  const highlighted = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((m, i) => {
      if (!m.content || m.index < last) return;
      parts.push(text.slice(last, m.index));
      parts.push(
        <mark key={i} className="rounded-sm border-b-2 border-primary bg-primary/20 px-0.5 font-bold text-foreground">
          {m.content}
        </mark>,
      );
      last = m.index + m.content.length;
    });
    parts.push(text.slice(last));
    return parts;
  }, [matches, text]);

  const loadSample = () => {
    setPattern('(\\w+)@(\\w+)\\.com');
    setFlags('gi');
    setText('Contatos: ana@totvs.com, bruno@agile.com e carlos@exemplo.org');
  };

  return (
    <DevToolPage
      toolId="regex-lab"
      actions={
        <Button variant="outline" size="sm" onClick={loadSample} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {/* Coluna esquerda: expressão + texto de teste */}
        <div className="flex min-h-0 flex-col gap-3">
          <section className="shrink-0 space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expressão</h2>
              {error ? <Badge variant="destructive" className="text-[10px]">Inválida</Badge> : <Badge variant="secondary" className="text-[10px]">Válida</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-code font-bold text-muted-foreground">/</span>
              <Input
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                placeholder="Seu padrão regex…"
                spellCheck={false}
                aria-label="Padrão regex"
                className={cn('h-9 rounded-lg font-code text-sm', error && 'border-destructive text-destructive')}
              />
              <span className="font-code font-bold text-muted-foreground">/</span>
              <Input
                value={flags}
                onChange={e => setFlags(e.target.value)}
                spellCheck={false}
                aria-label="Flags"
                className="h-9 w-16 rounded-lg font-code text-sm font-bold text-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FLAG_OPTIONS.map(o => (
                <button
                  key={o.flag}
                  type="button"
                  title={o.hint}
                  onClick={() => toggleFlag(o.flag)}
                  aria-pressed={flags.includes(o.flag)}
                  className={cn(
                    'rounded-full border px-3 py-1 font-code text-[11px] font-bold transition-colors',
                    flags.includes(o.flag) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {o.flag}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {CHEATS.map(([code, desc]) => (
                <span key={code} className="text-[11px] text-muted-foreground">
                  <code className="rounded bg-muted px-1 py-0.5 font-code font-bold text-foreground">{code}</code> {desc}
                </span>
              ))}
            </div>
          </section>
          <ToolPane
            className="flex-1"
            title="Texto de teste"
            value={text}
            onChange={setText}
            placeholder="Cole o texto para testar a expressão…"
            error={error}
            footer={`${text.length} caracteres`}
          />
        </div>

        {/* Coluna direita: visualização e lista de matches */}
        <div className="flex min-h-0 flex-col gap-3">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="shrink-0 border-b border-border/60 px-3 py-2">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visualização</h2>
            </header>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-code text-[13px] leading-relaxed">{highlighted}</div>
          </section>
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="shrink-0 border-b border-border/60 px-3 py-2">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Matches ({matches.length}{matches.length >= MAX_MATCHES ? '+' : ''})
              </h2>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {matches.length === 0 && <p className="py-6 text-center text-xs font-semibold text-muted-foreground">Nenhum resultado.</p>}
              {matches.map((m, i) => (
                <div key={i} className="space-y-1.5 rounded-xl border border-border bg-background p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>Match #{i + 1}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Índice {m.index}</span>
                  </div>
                  <p className="break-all rounded bg-muted px-2 py-1 font-code text-xs font-bold">{m.content || '(vazio)'}</p>
                  {m.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.groups.map((g, gi) => (
                        <Badge key={gi} variant="outline" className="font-code text-[10px]">${gi + 1}: {g ?? 'indefinido'}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DevToolPage>
  );
}
