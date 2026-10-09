'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, Copy, CreditCard, Database, RefreshCw, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { useToast } from '@/hooks/use-toast';
import {
  generateCNPJ, generateCPF, generateCreditCard, generatePerson,
  type CardBrand, type GeneratedCard, type GeneratedPerson,
} from './generators';

type Mode = 'single' | 'bulk';
type BulkType = 'person' | 'cpf' | 'cnpj' | 'card';
type BulkFormat = 'json' | 'csv' | 'sql';

// Mesma chave do Estúdio de Mocks: a massa exportada aparece lá.
const MOCKS_STORAGE_KEY = 'agile-space_custom_mocks';

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';
const selectClass = 'h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function TestDataPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('single');
  const [formatted, setFormatted] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Valores aleatórios só depois da montagem (evita divergência de hidratação).
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cardBrand, setCardBrand] = useState<CardBrand>('visa');
  const [card, setCard] = useState<GeneratedCard | null>(null);
  const [person, setPerson] = useState<GeneratedPerson | null>(null);

  const [bulkCount, setBulkCount] = useState(10);
  const [bulkType, setBulkType] = useState<BulkType>('person');
  const [bulkFormat, setBulkFormat] = useState<BulkFormat>('json');
  const [bulkResult, setBulkResult] = useState('');

  useEffect(() => {
    setCpf(generateCPF(true));
    setCnpj(generateCNPJ(true));
    setCard(generateCreditCard('visa'));
    setPerson(generatePerson(true));
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast({ title: 'Copiado para a área de transferência', description: text.length > 80 ? `${text.slice(0, 80)}…` : text });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  const toggleFormatted = (val: boolean) => {
    setFormatted(val);
    setCpf(generateCPF(val));
    setCnpj(generateCNPJ(val));
    setPerson(generatePerson(val));
  };

  const handleGenerateBulk = () => {
    const list: Record<string, string>[] = [];
    for (let i = 0; i < Math.min(bulkCount, 500); i++) {
      if (bulkType === 'person') list.push({ ...generatePerson(formatted) });
      else if (bulkType === 'cpf') list.push({ cpf: generateCPF(formatted) });
      else if (bulkType === 'cnpj') list.push({ cnpj: generateCNPJ(formatted) });
      else list.push({ ...generateCreditCard(cardBrand), brand: cardBrand.toUpperCase() });
    }
    if (list.length === 0) return;

    if (bulkFormat === 'json') {
      setBulkResult(JSON.stringify(list, null, 2));
    } else if (bulkFormat === 'csv') {
      const headers = Object.keys(list[0]).join(',');
      const rows = list.map(item => Object.values(item).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
      setBulkResult([headers, ...rows].join('\n'));
    } else {
      const columns = Object.keys(list[0]).join(', ');
      const values = list.map(item => `(${Object.values(item).map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ')})`).join(',\n  ');
      setBulkResult(`INSERT INTO tb_massa_${bulkType} (${columns})\nVALUES\n  ${values};`);
    }
    toast({ title: 'Massa gerada', description: `${list.length} registros no formato ${bulkFormat.toUpperCase()}.` });
  };

  const exportAsMock = () => {
    if (!bulkResult) return;
    try {
      const jsonPayload = bulkFormat === 'json' ? bulkResult : JSON.stringify({ data: bulkResult });
      const stored = localStorage.getItem(MOCKS_STORAGE_KEY);
      const mocks = stored ? JSON.parse(stored) : [];
      const newMock = {
        id: 'mock_' + Date.now(),
        method: 'GET',
        url: `https://api.empresa.com.br/v1/massa-${bulkType}`,
        cleanPath: `/api/v1/massa-${bulkType}`,
        payload: jsonPayload,
        statusCode: 200,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(MOCKS_STORAGE_KEY, JSON.stringify([newMock, ...mocks]));
      toast({ title: 'Massa exportada para o Estúdio de Mocks', description: `Endpoint GET /api/v1/massa-${bulkType} salvo com sucesso.` });
    } catch {
      toast({ title: 'Erro ao salvar o mock', variant: 'destructive' });
    }
  };

  const CopyBtn = ({ text, k }: { text: string; k: string }) => (
    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(text, k)} disabled={!text} className="absolute right-1 top-1 h-7 w-7 rounded-lg text-muted-foreground hover:text-primary" aria-label="Copiar">
      {copiedKey === k ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );

  const generateBtn = 'h-9 w-full gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider';
  const cardClass = 'space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm';

  return (
    <DevToolPage
      toolId="test-data"
      scrollBody
      actions={
        <div className="flex h-8 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <span>Pontuação</span>
          <Switch checked={formatted} onCheckedChange={toggleFormatted} aria-label="Pontuação nos documentos" />
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-3 md:space-y-4">
        <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
          <TabsList className="h-8 rounded-xl p-0.5">
            <TabsTrigger value="single" className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider">Individual</TabsTrigger>
            <TabsTrigger value="bulk" className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider">Em lote</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'single' ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 md:gap-4">
              <article className={cardClass}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-headline text-xs font-black uppercase tracking-wider text-foreground"><User className="h-4 w-4 text-primary" /> CPF válido</span>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold">Verificador OK</Badge>
                </div>
                <div className="relative">
                  <Input readOnly value={cpf} className="h-10 rounded-lg pr-10 font-code text-base font-bold" />
                  <CopyBtn text={cpf} k="cpf" />
                </div>
                <Button variant="outline" onClick={() => setCpf(generateCPF(formatted))} className={generateBtn}><RefreshCw className="h-3.5 w-3.5" /> Novo CPF</Button>
              </article>

              <article className={cardClass}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-headline text-xs font-black uppercase tracking-wider text-foreground"><Building2 className="h-4 w-4 text-primary" /> CNPJ válido</span>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold">Matriz 0001</Badge>
                </div>
                <div className="relative">
                  <Input readOnly value={cnpj} className="h-10 rounded-lg pr-10 font-code text-base font-bold" />
                  <CopyBtn text={cnpj} k="cnpj" />
                </div>
                <Button variant="outline" onClick={() => setCnpj(generateCNPJ(formatted))} className={generateBtn}><RefreshCw className="h-3.5 w-3.5" /> Novo CNPJ</Button>
              </article>

              <article className={cardClass}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-headline text-xs font-black uppercase tracking-wider text-foreground"><CreditCard className="h-4 w-4 text-primary" /> Cartão</span>
                  <select
                    value={cardBrand}
                    onChange={e => {
                      const b = e.target.value as CardBrand;
                      setCardBrand(b);
                      setCard(generateCreditCard(b));
                    }}
                    className="h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-black uppercase text-foreground"
                    aria-label="Bandeira"
                  >
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="elo">Elo</option>
                    <option value="amex">Amex</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Input readOnly value={card?.number ?? ''} className="h-10 rounded-lg pr-10 font-code text-sm font-bold" />
                    <CopyBtn text={card?.number ?? ''} k="card-num" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className={labelClass}>Validade</span>
                      <Input readOnly value={card?.exp ?? ''} className="h-9 rounded-lg font-code text-xs font-bold" />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>CVV</span>
                      <Input readOnly value={card?.cvv ?? ''} className="h-9 rounded-lg font-code text-xs font-bold" />
                    </div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setCard(generateCreditCard(cardBrand))} className={generateBtn}><RefreshCw className="h-3.5 w-3.5" /> Gerar cartão</Button>
              </article>
            </div>

            <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-headline text-sm font-black uppercase tracking-tight text-foreground"><User className="h-4 w-4 text-primary" /> Perfil completo de teste</h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => person && copyToClipboard(JSON.stringify(person, null, 2), 'person-json')} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                    {copiedKey === 'person-json' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} Copiar JSON
                  </Button>
                  <Button size="sm" onClick={() => setPerson(generatePerson(formatted))} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                    <RefreshCw className="h-3.5 w-3.5" /> Nova pessoa
                  </Button>
                </div>
              </div>
              {person && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  {([
                    ['Nome completo', person.nome, false],
                    ['E-mail', person.email, false],
                    ['CPF', person.cpf, true],
                    ['Telefone', person.telefone, true],
                    ['RG', person.rg, true],
                    ['Data de nascimento', person.dataNascimento, true],
                    ['Cidade principal', person.cidade, false],
                  ] as const).map(([label, value, mono]) => (
                    <div key={label} className="rounded-xl border border-border bg-muted/40 p-3">
                      <span className={`${labelClass} mb-1 block`}>{label}</span>
                      <span className={`block truncate text-xs font-semibold text-foreground ${mono ? 'font-code' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 md:gap-4">
            <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-1">
              <h2 className={labelClass}>Parâmetros do lote</h2>
              <div className="space-y-1">
                <Label className={labelClass}>Quantidade (máx. 500)</Label>
                <Input type="number" min={1} max={500} value={bulkCount} onChange={e => setBulkCount(parseInt(e.target.value) || 10)} className="h-9 rounded-lg font-bold" />
              </div>
              <div className="space-y-1">
                <Label className={labelClass}>Tipo de dado</Label>
                <select value={bulkType} onChange={e => setBulkType(e.target.value as BulkType)} className={selectClass}>
                  <option value="person">Pessoas completas</option>
                  <option value="cpf">Apenas CPFs</option>
                  <option value="cnpj">Apenas CNPJs</option>
                  <option value="card">Cartões de crédito</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className={labelClass}>Formato de exportação</Label>
                <select value={bulkFormat} onChange={e => setBulkFormat(e.target.value as BulkFormat)} className={selectClass}>
                  <option value="json">JSON (array)</option>
                  <option value="csv">CSV (planilhas)</option>
                  <option value="sql">SQL (INSERT INTO)</option>
                </select>
              </div>
              <Button onClick={handleGenerateBulk} className="h-10 w-full gap-2 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <RefreshCw className="h-4 w-4" /> Gerar {bulkCount} registros
              </Button>
            </section>

            <ToolPane
              className="h-[60dvh] lg:col-span-2 lg:h-[calc(100dvh-14rem)]"
              title="Resultado gerado"
              value={bulkResult}
              readOnly
              placeholder="Configure o lote e clique em gerar."
              downloadName={`massa_dados_${bulkType}.${bulkFormat}`}
              footer={bulkResult ? `${bulkResult.length} caracteres` : undefined}
              toolbar={
                <Button size="sm" variant="ghost" onClick={exportAsMock} disabled={!bulkResult} className="h-7 gap-1.5 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary">
                  <Database className="h-3.5 w-3.5" /> Criar mock
                </Button>
              }
            />
          </div>
        )}
      </div>
    </DevToolPage>
  );
}
