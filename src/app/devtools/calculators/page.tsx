'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { cn } from '@/lib/utils';
import {
  BYTE_UNITS, circleCalc, convertBytes, formatResult, operate, rectangleCalc, squareCalc, triangleCalc,
  type ByteUnit, type GeoResult, type Op,
} from './logic';

const triggerCls = 'h-8 rounded-lg px-4 text-[10px] font-black uppercase tracking-wider';
const card = 'rounded-2xl border border-border bg-card p-4 shadow-sm';
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

// ── Calculadora padrão ──
const OP_LABEL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function StandardCalculator() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(false); // próximo dígito substitui o display (após "=" ou erro)

  const digit = (d: string) => {
    if (fresh || display === 'Erro') { setDisplay(d === '.' ? '0.' : d); setFresh(false); return; }
    if (d === '.' && display.includes('.')) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  };
  const pickOp = (o: Op) => {
    // encadeia: 2 + 3 + … calcula o parcial antes de trocar de operação
    if (prev !== null && op && !fresh) {
      const r = operate(prev, op, parseFloat(display));
      setPrev(Number.isFinite(r) ? r : null);
      setDisplay(formatResult(r));
    } else {
      setPrev(parseFloat(display));
    }
    setOp(o);
    setFresh(true);
  };
  const equals = () => {
    if (prev === null || !op) return;
    setDisplay(formatResult(operate(prev, op, parseFloat(display))));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };
  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); setFresh(false); };

  const keys: { label: string; onClick: () => void; kind?: 'fn' | 'op'; wide?: boolean }[] = [
    { label: 'AC', onClick: clear, kind: 'fn' },
    { label: '+/−', onClick: () => display !== '0' && display !== 'Erro' && setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display), kind: 'fn' },
    { label: '%', onClick: () => display !== 'Erro' && setDisplay(formatResult(parseFloat(display) / 100)), kind: 'fn' },
    { label: '÷', onClick: () => pickOp('/'), kind: 'op' },
    ...['7', '8', '9'].map(d => ({ label: d, onClick: () => digit(d) })),
    { label: '×', onClick: () => pickOp('*'), kind: 'op' as const },
    ...['4', '5', '6'].map(d => ({ label: d, onClick: () => digit(d) })),
    { label: '−', onClick: () => pickOp('-'), kind: 'op' as const },
    ...['1', '2', '3'].map(d => ({ label: d, onClick: () => digit(d) })),
    { label: '+', onClick: () => pickOp('+'), kind: 'op' as const },
    { label: '0', onClick: () => digit('0'), wide: true },
    { label: ',', onClick: () => digit('.') },
    { label: '=', onClick: equals, kind: 'op' as const },
  ];

  return (
    <div className={cn(card, 'mx-auto w-full max-w-xs space-y-3')}>
      <div className="rounded-xl bg-muted px-4 py-3 text-right">
        <p className="h-4 font-code text-[11px] text-muted-foreground">{prev !== null && op ? `${prev} ${OP_LABEL[op]}` : ' '}</p>
        <p className="truncate font-code text-4xl font-bold tabular-nums" aria-live="polite">{display.replace('.', ',')}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keys.map(k => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            className={cn(
              'h-12 rounded-xl text-lg font-bold transition-transform active:scale-95',
              k.wide && 'col-span-2 pl-5 text-left',
              k.kind === 'op' ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : k.kind === 'fn' ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'border border-border bg-background hover:bg-muted',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Geometria ──
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      <Input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className="h-9 rounded-lg font-code" />
    </label>
  );
}

function GeoCard({ title, formula, result, children }: { title: string; formula: string; result: GeoResult | null; children: React.ReactNode }) {
  return (
    <div className={cn(card, 'space-y-3')}>
      <div>
        <h3 className="font-headline text-base font-black uppercase tracking-tight">{title}</h3>
        <p className="font-code text-[11px] text-muted-foreground">{formula}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-primary/10 p-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Área</p>
          <p className="font-code text-sm font-bold">{result ? fmt(result.area) : '—'}</p>
        </div>
        <div className="rounded-xl bg-muted p-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Perímetro</p>
          <p className="font-code text-sm font-bold">{result?.perimeter != null ? fmt(result.perimeter) : '—'}</p>
        </div>
      </div>
    </div>
  );
}

function Geometry() {
  const [side, setSide] = useState('');
  const [rw, setRw] = useState('');
  const [rh, setRh] = useState('');
  const [radius, setRadius] = useState('');
  const [tb, setTb] = useState('');
  const [th, setTh] = useState('');
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <GeoCard title="Quadrado" formula="A = L² · P = 4L" result={squareCalc(side)}>
        <div className="col-span-2"><Field label="Lado (L)" value={side} onChange={setSide} /></div>
      </GeoCard>
      <GeoCard title="Retângulo" formula="A = B × H · P = 2(B+H)" result={rectangleCalc(rw, rh)}>
        <Field label="Base (B)" value={rw} onChange={setRw} />
        <Field label="Altura (H)" value={rh} onChange={setRh} />
      </GeoCard>
      <GeoCard title="Círculo" formula="A = πr² · P = 2πr" result={circleCalc(radius)}>
        <div className="col-span-2"><Field label="Raio (r)" value={radius} onChange={setRadius} /></div>
      </GeoCard>
      <GeoCard title="Triângulo" formula="A = (B × H) / 2" result={triangleCalc(tb, th)}>
        <Field label="Base (B)" value={tb} onChange={setTb} />
        <Field label="Altura (H)" value={th} onChange={setTh} />
      </GeoCard>
    </div>
  );
}

// ── Conversor de bytes ──
function Bytes() {
  const [value, setValue] = useState('1');
  const [unit, setUnit] = useState<ByteUnit>('GB');
  const n = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0;
  const binary = useMemo(() => (valid ? convertBytes(n, unit, 1024) : null), [valid, n, unit]);
  const decimal = useMemo(() => (valid ? convertBytes(n, unit, 1000) : null), [valid, n, unit]);

  const Table = ({ title, data }: { title: string; data: Record<ByteUnit, number> | null }) => (
    <div className={cn(card, 'space-y-2')}>
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
      {BYTE_UNITS.map(u => (
        <div key={u} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5">
          <span className="font-code text-xs font-bold text-primary">{u}</span>
          <span className="font-code text-xs font-bold">{data ? data[u].toLocaleString('pt-BR', { maximumFractionDigits: 6 }) : '—'}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className={cn(card, 'flex flex-wrap items-end gap-3')}>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor</span>
          <Input inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} className="h-9 w-40 rounded-lg font-code" />
        </label>
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidade</span>
          <Select value={unit} onValueChange={v => setUnit(v as ByteUnit)}>
            <SelectTrigger className="h-9 w-28 rounded-lg" aria-label="Unidade"><SelectValue /></SelectTrigger>
            <SelectContent>{BYTE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {!valid && <p className="text-xs font-semibold text-destructive">Informe um número maior ou igual a zero.</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Table title="Binário (base 1024: KiB, MiB…)" data={binary} />
        <Table title="Decimal (base 1000: kB, MB…)" data={decimal} />
      </div>
    </div>
  );
}

export default function CalculatorsPage() {
  return (
    <DevToolPage toolId="calculators" scrollBody>
      <Tabs defaultValue="standard" className="mx-auto w-full max-w-5xl space-y-4">
        <TabsList className="h-10 rounded-xl p-1">
          <TabsTrigger value="standard" className={triggerCls}>Padrão</TabsTrigger>
          <TabsTrigger value="geometry" className={triggerCls}>Geometria</TabsTrigger>
          <TabsTrigger value="bytes" className={triggerCls}>Bytes</TabsTrigger>
        </TabsList>
        <TabsContent value="standard"><StandardCalculator /></TabsContent>
        <TabsContent value="geometry"><Geometry /></TabsContent>
        <TabsContent value="bytes"><Bytes /></TabsContent>
      </Tabs>
    </DevToolPage>
  );
}
