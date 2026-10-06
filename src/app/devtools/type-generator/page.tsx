'use client';

import { useMemo, useState } from 'react';
import { Check, ClipboardPaste, Copy, Wand2 } from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { generateDelphiClasses, generateJavaClasses, generateTypeScriptInterfaces } from './generators';

type Lang = 'typescript' | 'java' | 'delphi';

const LANGS: { value: Lang; label: string; monaco: string }[] = [
  { value: 'typescript', label: 'TypeScript (interfaces)', monaco: 'typescript' },
  { value: 'java', label: 'Java (classes)', monaco: 'java' },
  { value: 'delphi', label: 'Delphi (unit)', monaco: 'pascal' },
];

const SAMPLE = JSON.stringify(
  { id: 101, projeto: 'DDWMISSI', ativo: true, pontos: 8.5, responsavel: { nome: 'Wanderson', cargo: 'Dev' }, tarefas: [{ chave: 'DDW-1', titulo: 'Criar testes' }] },
  null, 2,
);

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  wordWrap: 'on',
  automaticLayout: true,
  padding: { top: 10, bottom: 10 },
  scrollBeyondLastLine: false,
} as const;

// Converte a mensagem do JSON.parse numa dica com posição legível.
function describeJsonError(message: string): string {
  const pos = message.match(/position (\d+)/i);
  if (pos) return `JSON inválido perto do caractere ${pos[1]}.`;
  const lc = message.match(/line (\d+) column (\d+)/i);
  if (lc) return `JSON inválido perto da linha ${lc[1]}, coluna ${lc[2]}.`;
  return `JSON inválido: ${message}`;
}

export default function TypeGeneratorPage() {
  const { resolvedMode } = useTheme();
  const { toast } = useToast();
  const monacoTheme = resolvedMode === 'dark' ? 'vs-dark' : 'vs';
  const [input, setInput] = useState('');
  const [lang, setLang] = useState<Lang>('typescript');
  const [copied, setCopied] = useState(false);

  // Gera a cada alteração; erro de parse vira mensagem, não exceção.
  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null as string | null };
    try {
      const gen = lang === 'typescript' ? generateTypeScriptInterfaces : lang === 'java' ? generateJavaClasses : generateDelphiClasses;
      return { output: gen(input, 'Root'), error: null };
    } catch (e) {
      return { output: '', error: describeJsonError(e instanceof Error ? e.message : String(e)) };
    }
  }, [input, lang]);

  const paste = async () => {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      toast({ title: 'Não foi possível colar', description: 'Permita o acesso à área de transferência ou cole com Ctrl+V.', variant: 'destructive' });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const monacoLang = LANGS.find(l => l.value === lang)!.monaco;
  const iconBtn = 'h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground';

  return (
    <DevToolPage
      toolId="type-generator"
      actions={
        <div className="flex items-center gap-2">
          <Select value={lang} onValueChange={v => setLang(v as Lang)}>
            <SelectTrigger className="h-8 w-[190px] rounded-xl text-[11px] font-bold" aria-label="Linguagem de saída">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map(l => <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE)} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
            <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
          </Button>
        </div>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">JSON de entrada</h2>
            <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={paste} title="Colar" aria-label="Colar">
              <ClipboardPaste className="h-3.5 w-3.5" />
            </Button>
          </header>
          <div className="min-h-0 flex-1">
            <Editor height="100%" language="json" theme={monacoTheme} value={input} onChange={v => setInput(v ?? '')} options={EDITOR_OPTIONS} />
          </div>
          {error && <footer className="shrink-0 border-t border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[11px] font-semibold text-destructive">{error}</footer>}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipos gerados</h2>
            <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={copy} disabled={!output} title="Copiar" aria-label="Copiar">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </header>
          <div className="min-h-0 flex-1">
            <Editor height="100%" language={monacoLang} theme={monacoTheme} value={output} options={{ ...EDITOR_OPTIONS, readOnly: true }} />
          </div>
        </section>
      </div>
    </DevToolPage>
  );
}
