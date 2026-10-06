'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, Loader2, MapPin, RefreshCw, Search, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { analyzeIpv4, parseIpv4 } from '@/lib/devtools/ip';

interface GeoData {
  ip: string; city?: string; region?: string; country_name?: string; org?: string; postal?: string;
  latitude?: number; longitude?: number; timezone?: string;
}

// ipapi.co/json/ devolve o IP de quem chama; ipapi.co/{ip}/json/ consulta outro IP.
// Quando estoura o limite gratuito responde 200 com { error: true, reason }.
async function fetchGeo(ip?: string): Promise<GeoData> {
  const res = await fetch(`https://ipapi.co/${ip ? `${ip}/` : ''}json/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || 'consulta recusada');
  return data;
}

const geoLines = (g: GeoData) =>
  [
    `IP: ${g.ip}`,
    g.org && `Provedor (ISP): ${g.org}`,
    (g.city || g.region) && `Localização: ${[g.city, g.region].filter(Boolean).join(', ')}`,
    g.country_name && `País: ${g.country_name}`,
    g.postal && `CEP/Postal: ${g.postal}`,
    g.timezone && `Fuso horário: ${g.timezone}`,
    g.latitude !== undefined && `Coordenadas: ${g.latitude}, ${g.longitude}`,
  ].filter(Boolean) as string[];

export default function IpAnalyzerPage() {
  const [input, setInput] = useState('');
  const [mine, setMine] = useState<GeoData | null>(null);
  const [mineLoading, setMineLoading] = useState(true);
  const [mineError, setMineError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<GeoData | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setMineLoading(true);
    setMineError(null);
    try {
      setMine(await fetchGeo());
    } catch (e) {
      setMine(null);
      setMineError(`Não foi possível obter seu IP público (${(e as Error).message}). Verifique a conexão ou bloqueadores de rede.`);
    } finally {
      setMineLoading(false);
    }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  // Análise local (instantânea) do que foi digitado
  const analysis = useMemo(() => (input.trim() ? analyzeIpv4(input) : null), [input]);

  const doLookup = async () => {
    if (!analysis?.ok) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookup(null);
    try {
      setLookup(await fetchGeo(analysis.data.ip));
    } catch (e) {
      setLookupError(`Falha na geolocalização (${(e as Error).message}).`);
    } finally {
      setLookupLoading(false);
    }
  };

  const output = useMemo(() => {
    if (!analysis?.ok) return '';
    const d = analysis.data;
    const lines = [
      `IP: ${d.ip}/${d.prefix}`,
      `Tipo: ${d.kind}`,
      `Classe: ${d.ipClass}`,
      `Máscara: ${d.mask}`,
      `Wildcard: ${d.wildcard}`,
      `Rede: ${d.network}`,
      `Broadcast: ${d.broadcast}`,
      `Primeiro host: ${d.firstHost}`,
      `Último host: ${d.lastHost}`,
      `Endereços totais: ${d.totalAddresses.toLocaleString('pt-BR')}`,
      `Hosts utilizáveis: ${d.usableHosts.toLocaleString('pt-BR')}`,
      `Binário: ${d.binary}`,
    ];
    if (lookup) lines.push('', '— Geolocalização (ipapi.co) —', ...geoLines(lookup));
    return lines.join('\n');
  }, [analysis, lookup]);

  // Texto de erro: IPv6 é reconhecido mas não calculado
  const inputError = analysis && !analysis.ok
    ? (input.includes(':') ? 'IPv6 ainda não é analisado aqui: use IPv4 ou CIDR IPv4.' : analysis.error)
    : null;

  const canLookup = !!analysis?.ok && analysis.data.isPublic && parseIpv4(analysis.data.ip) !== null;

  return (
    <DevToolPage
      toolId="ip-analyzer"
      actions={
        <Button variant="outline" size="sm" onClick={() => { setInput('192.168.1.130/24'); setLookup(null); setLookupError(null); }} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-4">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">IP ou bloco CIDR</h2>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => { setInput(e.target.value); setLookup(null); setLookupError(null); }}
                placeholder="10.0.0.5/24"
                spellCheck={false}
                aria-label="IP ou CIDR"
                className="h-9 rounded-xl font-code"
              />
              <Button onClick={doLookup} disabled={!canLookup || lookupLoading} title={canLookup ? 'Consultar localização e provedor' : 'Disponível para IPs públicos'} className="h-9 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                {lookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Localizar
              </Button>
            </div>
            {(inputError || lookupError) && <p className="text-xs font-semibold text-destructive">{inputError ?? lookupError}</p>}
            <p className="text-[11px] font-medium text-muted-foreground">
              Máscara, faixa e tipo são calculados no navegador. &quot;Localizar&quot; envia o IP ao serviço público ipapi.co e só vale para IPs públicos.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seu IP público</h2>
              <Button variant="ghost" size="icon" onClick={loadMine} disabled={mineLoading} className="h-7 w-7 rounded-lg" aria-label="Atualizar" title="Atualizar">
                <RefreshCw className={mineLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              </Button>
            </div>
            {mineLoading ? (
              <div className="h-12 animate-pulse rounded-xl bg-muted" />
            ) : mineError ? (
              <p className="text-xs font-semibold text-destructive">{mineError}</p>
            ) : mine ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <button
                    type="button"
                    onClick={() => setInput(mine.ip)}
                    title="Analisar este IP"
                    className="font-code text-2xl font-black tracking-tight hover:text-primary"
                  >
                    {mine.ip}
                  </button>
                </div>
                <ul className="space-y-1 text-xs font-medium text-muted-foreground">
                  {geoLines(mine).slice(1).map(l => (
                    <li key={l} className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{l}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-[11px] font-medium text-muted-foreground">
              Com VPN ou proxy corporativo (Netskope, Zscaler, Cloudflare WARP), o IP e a localização mostrados são os do túnel, não os da sua máquina. É esse IP que deve entrar em liberações de firewall na nuvem. Dados: ipapi.co.
            </p>
          </section>
        </div>

        <ToolPane title="Análise" value={output} readOnly placeholder="Digite um IPv4 ou CIDR (ex.: 10.0.0.5/24) para ver máscara, faixa e tipo." downloadName="ip.txt" />
      </div>
    </DevToolPage>
  );
}
