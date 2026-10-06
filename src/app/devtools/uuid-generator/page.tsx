'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { generateId, type IdKind } from './ids';

const KINDS: { value: IdKind; label: string; hint: string }[] = [
  { value: 'v4', label: 'UUID v4', hint: 'Aleatório (RFC 4122).' },
  { value: 'v7', label: 'UUID v7', hint: 'Ordenável por tempo (timestamp em ms + aleatório).' },
  { value: 'ulid', label: 'ULID', hint: '26 caracteres, ordenável por tempo, Crockford base32.' },
  { value: 'nanoid', label: 'NanoID', hint: '21 caracteres URL-safe, compacto.' },
];

const MAX = 500;

export default function UuidGeneratorPage() {
  const [kind, setKind] = useState<IdKind>('v4');
  const [count, setCount] = useState(10);
  const [upper, setUpper] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  const generate = useCallback(() => {
    const n = Math.min(MAX, Math.max(1, Math.floor(count) || 1));
    setIds(Array.from({ length: n }, () => generateId(kind)));
  }, [count, kind]);

  // Gera ao abrir (no cliente, para não divergir na hidratação) e ao trocar o tipo.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Formatação é aplicada na exibição: alternar opções não gera novos IDs.
  const output = ids
    .map(id => {
      let s = noDashes && kind !== 'ulid' && kind !== 'nanoid' ? id.replace(/-/g, '') : id;
      if (upper && kind !== 'nanoid') s = s.toUpperCase(); // NanoID diferencia maiúsculas: não altera
      return s;
    })
    .join('\n');

  const hint = KINDS.find(k => k.value === kind)!.hint;
  const isUuid = kind === 'v4' || kind === 'v7';

  return (
    <DevToolPage
      toolId="uuid-generator"
      actions={
        <Button size="sm" onClick={generate} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Gerar</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[300px_1fr] md:gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Opções</h2>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo</Label>
              <Tabs value={kind} onValueChange={v => setKind(v as IdKind)}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
                  {KINDS.map(k => (
                    <TabsTrigger key={k.value} value={k.value} className="rounded-lg text-[11px] font-black">{k.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-[11px] font-medium text-muted-foreground">{hint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="count" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantidade (1 a {MAX})</Label>
              <Input id="count" type="number" min={1} max={MAX} value={count} onChange={e => setCount(Number(e.target.value))} className="h-9 rounded-lg font-code" />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="upper" className="text-xs font-semibold">Maiúsculas</Label>
              <Switch id="upper" checked={upper} onCheckedChange={setUpper} disabled={kind === 'nanoid'} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dashes" className="text-xs font-semibold">Sem hífens</Label>
              <Switch id="dashes" checked={noDashes} onCheckedChange={setNoDashes} disabled={!isUuid} />
            </div>
          </div>
        </section>

        <ToolPane
          title={`Identificadores (${ids.length})`}
          value={output}
          readOnly
          placeholder="Clique em Gerar."
          downloadName="ids.txt"
          footer="Um por linha. Gerados com crypto.getRandomValues, no navegador."
        />
      </div>
    </DevToolPage>
  );
}
