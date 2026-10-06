'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HTTP_METHODS, emptyKv, methodHasBody, type KeyValue, type RequestModel } from '@/lib/devtools/http-request';
import { cn } from '@/lib/utils';

interface RequestEditorProps {
  value: RequestModel;
  onChange: (next: RequestModel) => void;
  /** Botão/ação ao lado da URL (ex.: "Enviar"). */
  urlAction?: React.ReactNode;
  className?: string;
}

const tabTrigger =
  'h-9 rounded-none border-b-2 border-transparent px-1 text-[10px] font-black uppercase tracking-widest shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none';

// Editor de requisição (método, URL, params, headers e corpo) usado pelo Cliente HTTP e pelos Snippets.
export function RequestEditor({ value, onChange, urlAction, className }: RequestEditorProps) {
  const set = (patch: Partial<RequestModel>) => onChange({ ...value, ...patch });
  const filled = (list: KeyValue[]) => list.filter(i => i.key.trim()).length;

  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 p-2">
        <Select value={value.method} onValueChange={method => set({ method })}>
          <SelectTrigger className="h-9 w-[110px] rounded-xl text-[11px] font-black uppercase tracking-wider" aria-label="Método HTTP">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map(m => (
              <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={value.url}
          onChange={e => set({ url: e.target.value })}
          placeholder="https://api.exemplo.com/v1/recurso"
          spellCheck={false}
          aria-label="URL"
          className="h-9 min-w-0 flex-1 rounded-xl font-code text-xs"
        />
        {urlAction}
      </div>

      <Tabs defaultValue="params" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-9 shrink-0 justify-start gap-5 rounded-none border-b border-border/60 bg-transparent px-3 py-0">
          <TabsTrigger value="params" className={tabTrigger}>Params ({filled(value.params)})</TabsTrigger>
          <TabsTrigger value="headers" className={tabTrigger}>Headers ({filled(value.headers)})</TabsTrigger>
          <TabsTrigger value="body" className={tabTrigger}>Body</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
          <KvList items={value.params} onChange={params => set({ params })} addLabel="Adicionar parâmetro" />
        </TabsContent>
        <TabsContent value="headers" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
          <KvList items={value.headers} onChange={headers => set({ headers })} addLabel="Adicionar header" />
        </TabsContent>
        <TabsContent value="body" className="m-0 flex min-h-0 flex-1 flex-col">
          <Textarea
            value={value.body}
            onChange={e => set({ body: e.target.value })}
            placeholder={methodHasBody(value.method) ? '{ "chave": "valor" }' : `${value.method} não envia corpo`}
            disabled={!methodHasBody(value.method)}
            spellCheck={false}
            aria-label="Corpo da requisição"
            className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-3 font-code text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function KvList({ items, onChange, addLabel }: { items: KeyValue[]; onChange: (next: KeyValue[]) => void; addLabel: string }) {
  const update = (id: string, patch: Partial<KeyValue>) => onChange(items.map(i => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div className="space-y-2">
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-2">
          <Input value={i.key} onChange={e => update(i.id, { key: e.target.value })} placeholder="Chave" spellCheck={false} aria-label="Chave" className="h-8 flex-1 rounded-lg font-code text-xs" />
          <Input value={i.value} onChange={e => update(i.id, { value: e.target.value })} placeholder="Valor" spellCheck={false} aria-label="Valor" className="h-8 flex-[1.4] rounded-lg font-code text-xs" />
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter(x => x.id !== i.id))} className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Remover">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, emptyKv()])} className="h-8 w-full gap-1.5 rounded-lg border-dashed text-[10px] font-black uppercase tracking-wider">
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
