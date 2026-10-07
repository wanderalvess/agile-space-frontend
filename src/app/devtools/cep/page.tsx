'use client';

import { useState } from 'react';
import { ExternalLink, Hash, Loader2, MapPin, Search, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

interface CepData {
  cep: string; logradouro: string; complemento: string; bairro: string; localidade: string; uf: string;
  estado?: string; regiao?: string; ibge: string; gia: string; ddd: string; siafi: string;
}

// 00000-000 enquanto digita
const maskCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export default function CepPage() {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CepData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (value = cep) => {
    const raw = value.replace(/\D/g, '');
    if (raw.length !== 8) {
      setError('O CEP deve ter exatamente 8 dígitos.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // ViaCEP é pública e libera CORS: consulta direto do navegador.
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (data.erro) setError('CEP não encontrado. Confira o número e tente de novo.');
      else setResult(data);
    } catch {
      setError('Não foi possível consultar o ViaCEP agora. Verifique sua conexão e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  const rows: [string, string][] = result
    ? [
        ['CEP', result.cep], ['Logradouro', result.logradouro], ['Complemento', result.complemento], ['Bairro', result.bairro],
        ['Cidade', result.localidade], ['UF', result.uf], ['Estado', result.estado ?? ''], ['Região', result.regiao ?? ''],
        ['IBGE', result.ibge], ['DDD', result.ddd], ['SIAFI', result.siafi], ['GIA', result.gia],
      ]
    : [];
  const filledRows = rows.filter(([, v]) => v);
  const fullAddress = result ? `${result.logradouro}, ${result.bairro}, ${result.localidade} - ${result.uf}, ${result.cep}` : '';
  const mapsUrl = result
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.logradouro}, ${result.localidade}, ${result.uf}`)}`
    : '';

  return (
    <DevToolPage
      toolId="cep"
      actions={
        <Button
          variant="outline" size="sm"
          onClick={() => { setCep('01001-000'); search('01001-000'); }}
          className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
        >
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-4">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CEP de 8 dígitos</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={cep}
                  onChange={e => setCep(maskCep(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  aria-label="CEP"
                  className="h-10 rounded-xl pl-9 font-code text-base font-bold"
                />
              </div>
              <Button onClick={() => search()} disabled={loading} className="h-10 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </Button>
            </div>
            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
            <p className="text-[11px] font-medium text-muted-foreground">
              A consulta vai direto do seu navegador para a API pública ViaCEP (viacep.com.br); o CEP digitado é enviado a esse serviço.
            </p>
          </section>

          {result && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <h3 className="truncate font-headline text-lg font-black uppercase tracking-tight">{result.localidade} - {result.uf}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{result.logradouro || 'CEP geral da cidade'}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <a href={mapsUrl} target="_blank" rel="noreferrer">Abrir no Maps <ExternalLink className="h-3 w-3" /></a>
              </Button>
            </section>
          )}
        </div>

        <ToolPane
          title="Endereço"
          value={result ? `${fullAddress}\n\n${filledRows.map(([k, v]) => `${k}: ${v}`).join('\n')}` : ''}
          readOnly
          placeholder="Digite um CEP e busque. O resultado aparece aqui."
          downloadName="endereco.txt"
          footer={result ? 'Fonte: ViaCEP' : undefined}
        />
      </div>
    </DevToolPage>
  );
}
