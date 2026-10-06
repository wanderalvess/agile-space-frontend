'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';
import { formatDocument, generateBatch, validateDocument, type DocType } from '@/lib/devtools/br-docs';

// ATENÇÃO: no legado esta ferramenta é um gerador/validador de CPF e CNPJ (clássico e alfanumérico),
// e não um gerador de documentação técnica como a descrição do registro sugere.

const TYPE_LABEL: Record<DocType, string> = { CPF: 'CPF', CNPJ_CLASSIC: 'CNPJ', CNPJ_ALPHANUM: 'CNPJ alfanumérico' };
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

export default function DocGeneratorPage() {
  const [type, setType] = useState<DocType>('CPF');
  const [qty, setQty] = useState(5);
  const [formatted, setFormatted] = useState(true);
  const [branchMode, setBranchMode] = useState(false);
  const [docs, setDocs] = useState<string[]>([]); // sempre crus (sem máscara); a máscara é aplicada na exibição
  const [valInput, setValInput] = useState('');

  const generate = () => setDocs(generateBatch(type, qty, branchMode));

  const output = useMemo(
    () => docs.map(d => (formatted ? formatDocument(d, type) : d)).join('\n'),
    [docs, formatted, type],
  );
  const validation = useMemo(() => validateDocument(valInput), [valInput]);
  const isCnpj = type !== 'CPF';

  return (
    <DevToolPage toolId="doc-generator">
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-4">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gerar documentos de teste</h2>

            <Tabs value={type} onValueChange={v => { setType(v as DocType); setDocs([]); }}>
              <TabsList className="grid h-9 w-full grid-cols-3 rounded-xl p-0.5">
                {(Object.keys(TYPE_LABEL) as DocType[]).map(t => (
                  <TabsTrigger key={t} value={t} className="rounded-lg px-1 text-[10px] font-black uppercase tracking-wider">{TYPE_LABEL[t]}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qty" className={labelCls}>Quantidade (1 a 100)</Label>
                <Input
                  id="qty" type="number" min={1} max={100} value={qty}
                  onChange={e => setQty(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                  className="h-9 rounded-xl font-code"
                />
              </div>
              <Button onClick={generate} className="h-9 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <RefreshCcw className="h-3.5 w-3.5" /> Gerar
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
              <Label htmlFor="fmt" className="text-xs font-semibold">Com máscara (pontos, barra e traço)</Label>
              <Switch id="fmt" checked={formatted} onCheckedChange={setFormatted} />
            </div>
            <div className={cn('flex items-center justify-between rounded-xl border border-border/60 px-3 py-2', !isCnpj && 'opacity-50')}>
              <Label htmlFor="br" className="text-xs font-semibold">Mesma raiz, filiais 0001, 0002… (CNPJ)</Label>
              <Switch id="br" checked={branchMode} onCheckedChange={setBranchMode} disabled={!isCnpj} />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">
              Os números passam no cálculo dos dígitos verificadores, mas não pertencem a pessoas ou empresas reais: use só em testes.
              O CNPJ alfanumérico segue o novo formato (letras e números na raiz e na filial).
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validar CPF / CNPJ</h2>
            <Input
              value={valInput}
              onChange={e => setValInput(e.target.value)}
              placeholder="Cole um CPF ou CNPJ, com ou sem máscara"
              spellCheck={false}
              aria-label="Documento a validar"
              className="h-9 rounded-xl font-code"
            />
            {validation && (
              <p className={cn('flex items-center gap-2 text-sm font-bold', validation.valid ? 'text-primary' : 'text-destructive')}>
                {validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {validation.message}
              </p>
            )}
          </section>
        </div>

        <ToolPane
          title={docs.length ? `${docs.length} × ${TYPE_LABEL[type]}` : 'Resultado'}
          value={output}
          readOnly
          placeholder="Escolha o tipo e clique em Gerar."
          downloadName={`documentos_${type.toLowerCase()}.txt`}
          footer={docs.length ? 'Um documento por linha.' : undefined}
        />
      </div>
    </DevToolPage>
  );
}
