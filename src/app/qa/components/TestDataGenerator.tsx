'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  Database, 
  CreditCard, 
  User, 
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// --- ALGORITMOS DE GERAÇÃO E VALIDAÇÃO ---

function randomDigits(num: number): string {
  let res = '';
  for (let i = 0; i < num; i++) {
    res += Math.floor(Math.random() * 10).toString();
  }
  return res;
}

// CPF Generator
function generateCPF(formatted: boolean = true): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  
  // Primeiro dígito verificador
  let d1 = n.reduce((acc, curr, index) => acc + curr * (10 - index), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  // Segundo dígito verificador
  let d2 = [...n, d1].reduce((acc, curr, index) => acc + curr * (11 - index), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  const raw = [...n, d1, d2].join('');
  if (!formatted) return raw;
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}

// CNPJ Generator
function generateCNPJ(formatted: boolean = true): string {
  const n = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  n.push(0, 0, 0, 1); // Filial 0001 por padrão

  const weight1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d1 = n.reduce((acc, curr, index) => acc + curr * weight1[index], 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  const weight2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d2 = [...n, d1].reduce((acc, curr, index) => acc + curr * weight2[index], 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  const raw = [...n, d1, d2].join('');
  if (!formatted) return raw;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

// Credit Card Generator (Luhn Algorithm)
function generateCreditCard(brand: 'visa' | 'mastercard' | 'elo' | 'amex' = 'visa'): { number: string; cvv: string; exp: string } {
  let prefix = '4';
  let length = 16;

  if (brand === 'mastercard') {
    prefix = ['51', '52', '53', '54', '55'][Math.floor(Math.random() * 5)];
  } else if (brand === 'amex') {
    prefix = ['34', '37'][Math.floor(Math.random() * 2)];
    length = 15;
  } else if (brand === 'elo') {
    prefix = '636368';
  }

  const numArr = prefix.split('').map(Number);
  while (numArr.length < length - 1) {
    numArr.push(Math.floor(Math.random() * 10));
  }

  // Calculate Luhn checksum
  let sum = 0;
  for (let i = 0; i < numArr.length; i++) {
    let val = numArr[numArr.length - 1 - i];
    if (i % 2 === 0) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  numArr.push(checkDigit);

  const cardNumber = numArr.join('');
  const cvv = brand === 'amex' ? randomDigits(4) : randomDigits(3);
  
  const currentYear = new Date().getFullYear();
  const expMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const expYear = String(currentYear + Math.floor(Math.random() * 5) + 1).slice(-2);

  return {
    number: cardNumber.replace(/(.{4})/g, '$1 ').trim(),
    cvv,
    exp: `${expMonth}/${expYear}`
  };
}

// Fake Person Generator
const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'Lucas', 'Mariana', 'Mateus', 'Patricia', 'Rafael', 'Sofia', 'Thiago'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho'];
const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Campinas', 'Recife', 'Florianópolis'];

function generatePerson(formatted: boolean = true) {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const fullName = `${firstName} ${lastName}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}@teste.com.br`;
  const cpf = generateCPF(formatted);
  const rg = `${randomDigits(2)}.${randomDigits(3)}.${randomDigits(3)}-${randomDigits(1)}`;
  const phone = `(11) 9${randomDigits(4)}-${randomDigits(4)}`;
  const birthYear = Math.floor(Math.random() * (2002 - 1970 + 1)) + 1970;
  const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

  return {
    nome: fullName,
    email,
    cpf,
    rg,
    telefone: phone,
    dataNascimento: `${birthDay}/${birthMonth}/${birthYear}`,
    cidade: CITIES[Math.floor(Math.random() * CITIES.length)]
  };
}

export function TestDataGenerator() {
  const { toast } = useToast();
  const [formatted, setFormatted] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Single Items state
  const [cpf, setCpf] = useState(() => generateCPF(true));
  const [cnpj, setCnpj] = useState(() => generateCNPJ(true));
  const [card, setCard] = useState(() => generateCreditCard('visa'));
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'elo' | 'amex'>('visa');
  const [person, setPerson] = useState(() => generatePerson(true));

  // Bulk Generator State
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkType, setBulkType] = useState<'person' | 'cpf' | 'cnpj' | 'card'>('person');
  const [bulkFormat, setBulkFormat] = useState<'json' | 'csv' | 'sql'>('json');
  const [bulkResult, setBulkResult] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({
      title: 'Copiado para a área de transferência!',
      description: text,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateBulk = () => {
    const list: any[] = [];
    for (let i = 0; i < Math.min(bulkCount, 500); i++) {
      if (bulkType === 'person') list.push(generatePerson(formatted));
      else if (bulkType === 'cpf') list.push({ cpf: generateCPF(formatted) });
      else if (bulkType === 'cnpj') list.push({ cnpj: generateCNPJ(formatted) });
      else if (bulkType === 'card') list.push({ ...generateCreditCard(cardBrand), brand: cardBrand.toUpperCase() });
    }

    if (bulkFormat === 'json') {
      setBulkResult(JSON.stringify(list, null, 2));
    } else if (bulkFormat === 'csv') {
      if (list.length === 0) return;
      const headers = Object.keys(list[0]).join(',');
      const rows = list.map(item => Object.values(item).map(v => `"${v}"`).join(','));
      setBulkResult([headers, ...rows].join('\n'));
    } else if (bulkFormat === 'sql') {
      if (list.length === 0) return;
      const tableName = `tb_massa_${bulkType}`;
      const columns = Object.keys(list[0]).join(', ');
      const values = list.map(item => `(${Object.values(item).map(v => `'${v}'`).join(', ')})`).join(',\n  ');
      setBulkResult(`INSERT INTO ${tableName} (${columns})\nVALUES\n  ${values};`);
    }

    toast({
      title: 'Massa gerada com sucesso!',
      description: `${list.length} registros no formato ${bulkFormat.toUpperCase()}.`
    });
  };

  const downloadBulk = () => {
    if (!bulkResult) return;
    const blob = new Blob([bulkResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `massa_dados_${bulkType}.${bulkFormat === 'sql' ? 'sql' : bulkFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMock = (payloadString: string) => {
    try {
      let jsonPayload = payloadString;
      if (bulkFormat !== 'json') {
        jsonPayload = JSON.stringify({ data: payloadString });
      }
      const stored = localStorage.getItem('agile-space_custom_mocks');
      const mocks = stored ? JSON.parse(stored) : [];
      const newMock = {
        id: 'mock_' + Date.now(),
        method: 'GET',
        url: `https://api.empresa.com.br/v1/massa-${bulkType}`,
        cleanPath: `/api/v1/massa-${bulkType}`,
        payload: jsonPayload,
        statusCode: 200,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('agile-space_custom_mocks', JSON.stringify([newMock, ...mocks]));
      toast({
        title: 'Massa exportada para o Estúdio de Mocks!',
        description: 'Endpoint GET /api/v1/massa-' + bulkType + ' salvo com sucesso.'
      });
    } catch (e) {
      toast({ title: 'Erro ao salvar Mock', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* HEADER BAR & CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Gerador de Massa de Dados QA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gere dados brasileiros válidos para formulários, testes de API e povoamento de banco de dados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <span>Pontuação</span>
            <Switch
              checked={formatted}
              onCheckedChange={(val) => {
                setFormatted(val);
                setCpf(generateCPF(val));
                setCnpj(generateCNPJ(val));
                setPerson(generatePerson(val));
              }}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <TabsTrigger value="single" className="rounded-lg font-bold text-xs">
            Gerador Individual
          </TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-lg font-bold text-xs">
            Geração em Lote (Bulk)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GERADOR INDIVIDUAL */}
        <TabsContent value="single" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* CARD CPF */}
            <Card className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">CPF Válido</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
                  Verificador OK
                </Badge>
              </div>

              <div className="relative">
                <Input 
                  readOnly 
                  value={cpf} 
                  className="font-mono text-base font-bold bg-slate-50 dark:bg-slate-950 pr-10"
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => copyToClipboard(cpf, 'cpf')}
                  className="absolute right-1 top-1 h-8 w-8 text-slate-500 hover:text-primary"
                >
                  {copiedKey === 'cpf' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <Button 
                onClick={() => setCpf(generateCPF(formatted))} 
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Novo CPF
              </Button>
            </Card>

            {/* CARD CNPJ */}
            <Card className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">CNPJ Válido</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-blue-600 border-blue-500/30 bg-blue-50 dark:bg-blue-950/30">
                  Empresa 0001
                </Badge>
              </div>

              <div className="relative">
                <Input 
                  readOnly 
                  value={cnpj} 
                  className="font-mono text-base font-bold bg-slate-50 dark:bg-slate-950 pr-10"
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => copyToClipboard(cnpj, 'cnpj')}
                  className="absolute right-1 top-1 h-8 w-8 text-slate-500 hover:text-primary"
                >
                  {copiedKey === 'cnpj' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <Button 
                onClick={() => setCnpj(generateCNPJ(formatted))} 
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Novo CNPJ
              </Button>
            </Card>

            {/* CARD CARTÃO DE CRÉDITO */}
            <Card className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Cartão de Crédito</span>
                </div>
                <select 
                  value={cardBrand}
                  onChange={(e) => {
                    const b = e.target.value as any;
                    setCardBrand(b);
                    setCard(generateCreditCard(b));
                  }}
                  className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 uppercase text-slate-700 dark:text-slate-300"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="elo">Elo</option>
                  <option value="amex">Amex</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Input readOnly value={card.number} className="font-mono text-sm font-bold bg-slate-50 dark:bg-slate-950 pr-10" />
                  <Button size="icon" variant="ghost" onClick={() => copyToClipboard(card.number, 'card-num')} className="absolute right-1 top-1 h-8 w-8 text-slate-500">
                    {copiedKey === 'card-num' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Validade</span>
                    <Input readOnly value={card.exp} className="font-mono text-xs font-bold bg-slate-50 dark:bg-slate-950" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">CVV</span>
                    <Input readOnly value={card.cvv} className="font-mono text-xs font-bold bg-slate-50 dark:bg-slate-950" />
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => setCard(generateCreditCard(cardBrand))} 
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Gerar Cartão
              </Button>
            </Card>

          </div>

          {/* CARD PESSOA COMPLETA */}
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Perfil Completo de Teste</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(JSON.stringify(person, null, 2), 'person-json')}
                  className="h-8 text-xs font-bold gap-1 rounded-xl"
                >
                  {copiedKey === 'person-json' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar JSON
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setPerson(generatePerson(formatted))}
                  className="h-8 bg-primary hover:bg-orange-600 text-white font-extrabold text-xs uppercase rounded-xl gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Gerar Nova Pessoa
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome Completo</span>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block truncate">{person.nome}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">E-mail</span>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block truncate">{person.email}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">CPF</span>
                <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 block">{person.cpf}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Telefone</span>
                <span className="font-mono text-xs text-slate-900 dark:text-slate-100 block">{person.telefone}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">RG</span>
                <span className="font-mono text-xs text-slate-900 dark:text-slate-100 block">{person.rg}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Nascimento</span>
                <span className="font-mono text-xs text-slate-900 dark:text-slate-100 block">{person.dataNascimento}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cidade Principal</span>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block">{person.cidade}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: GERAÇÃO EM LOTE */}
        <TabsContent value="bulk" className="space-y-6 mt-6">
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-2 block">Quantidade (Máx 500)</Label>
                <Input 
                  type="number" 
                  min={1} 
                  max={500} 
                  value={bulkCount} 
                  onChange={(e) => setBulkCount(parseInt(e.target.value) || 10)}
                  className="font-bold bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-2 block">Tipo de Dado</Label>
                <select 
                  value={bulkType} 
                  onChange={(e) => setBulkType(e.target.value as any)}
                  className="w-full h-10 px-3 font-semibold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
                >
                  <option value="person">Pessoas Completas</option>
                  <option value="cpf">Apenas CPFs</option>
                  <option value="cnpj">Apenas CNPJs</option>
                  <option value="card">Cartões de Crédito</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-2 block">Formato de Exportação</Label>
                <select 
                  value={bulkFormat} 
                  onChange={(e) => setBulkFormat(e.target.value as any)}
                  className="w-full h-10 px-3 font-semibold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
                >
                  <option value="json">JSON Array</option>
                  <option value="csv">CSV (Planilhas)</option>
                  <option value="sql">SQL (INSERT INTO)</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={handleGenerateBulk}
              className="w-full h-11 bg-primary hover:bg-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2 shadow-md"
            >
              <RefreshCw className="h-4 w-4" /> Gerar {bulkCount} Registros em Lote
            </Button>

            {bulkResult && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-500">Resultado Gerado:</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyToClipboard(bulkResult, 'bulk-copy')}
                      className="h-8 text-xs font-bold gap-1 rounded-xl"
                    >
                      {copiedKey === 'bulk-copy' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar Resultado
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={downloadBulk}
                      className="h-8 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 text-white font-bold text-xs gap-1 rounded-xl"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar Arquivo
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => exportAsMock(bulkResult)}
                      className="h-8 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1 rounded-xl"
                    >
                      <Database className="h-3.5 w-3.5" /> Criar Mock API
                    </Button>
                  </div>
                </div>

                <textarea
                  readOnly
                  value={bulkResult}
                  rows={10}
                  className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin"
                />
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
