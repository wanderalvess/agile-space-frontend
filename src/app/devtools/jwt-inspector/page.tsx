'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

// base64url -> texto UTF-8 (o legado usava atob direto, que falha com "-", "_" e acentos).
function b64urlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.codePointAt(0)!));
}

function b64urlEncodeJson(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return btoa(Array.from(bytes, b => String.fromCodePoint(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeSample(): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64urlEncodeJson({ alg: 'HS256', typ: 'JWT' }),
    b64urlEncodeJson({ sub: 'usuario-123', name: 'Maria da Silva', iss: 'portal-vd', aud: 'agile-space', iat: now, exp: now + 3600 }),
    'assinatura-ficticia',
  ].join('.');
}

interface Decoded { header: Record<string, unknown>; payload: Record<string, unknown>; signature: string }

function decode(token: string): Decoded {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) throw new Error('Formato inválido: um JWT tem 3 partes separadas por ponto (header.payload.assinatura).');
  try {
    return { header: JSON.parse(b64urlDecode(parts[0])), payload: JSON.parse(b64urlDecode(parts[1])), signature: parts[2] };
  } catch {
    throw new Error('Não foi possível decodificar: header ou payload não são Base64URL com JSON válido.');
  }
}

const fmtDate = (sec: number) => new Date(sec * 1000).toLocaleString('pt-BR');

function relative(sec: number): string {
  const diff = sec - Date.now() / 1000;
  const abs = Math.abs(diff);
  const [n, u] = abs < 3600 ? [Math.round(abs / 60), 'min'] : abs < 86400 ? [Math.round(abs / 3600), 'h'] : [Math.round(abs / 86400), 'd'];
  return diff >= 0 ? `em ${n} ${u}` : `há ${n} ${u}`;
}

export default function JwtInspectorPage() {
  const [token, setToken] = useState('');

  const { decoded, error } = useMemo(() => {
    if (!token.trim()) return { decoded: null as Decoded | null, error: null as string | null };
    try { return { decoded: decode(token), error: null }; }
    catch (e) { return { decoded: null, error: (e as Error).message }; }
  }, [token]);

  const p = decoded?.payload;
  const num = (k: string) => (typeof p?.[k] === 'number' ? (p[k] as number) : null);
  const exp = num('exp'), iat = num('iat'), nbf = num('nbf');
  const now = Date.now() / 1000;
  const state = exp !== null && now > exp ? 'expired' : nbf !== null && now < nbf ? 'early' : exp !== null ? 'valid' : 'noexp';

  const claims: { label: string; value: string }[] = [];
  if (iat !== null) claims.push({ label: 'iat (emitido)', value: `${fmtDate(iat)} · ${relative(iat)}` });
  if (nbf !== null) claims.push({ label: 'nbf (válido desde)', value: `${fmtDate(nbf)} · ${relative(nbf)}` });
  if (exp !== null) claims.push({ label: 'exp (expira)', value: `${fmtDate(exp)} · ${relative(exp)}` });
  for (const k of ['iss', 'sub', 'aud'] as const) {
    const v = p?.[k];
    if (v !== undefined) claims.push({ label: k, value: Array.isArray(v) ? v.join(', ') : String(v) });
  }

  const badge = {
    expired: <Badge variant="destructive" className="text-[10px] font-black uppercase">Expirado</Badge>,
    early: <Badge variant="outline" className="text-[10px] font-black uppercase">Ainda não válido</Badge>,
    valid: <Badge className="bg-primary text-[10px] font-black uppercase text-primary-foreground">Dentro da validade</Badge>,
    noexp: <Badge variant="secondary" className="text-[10px] font-black uppercase">Sem expiração</Badge>,
  };

  return (
    <DevToolPage
      toolId="jwt-inspector"
      actions={
        <Button variant="outline" size="sm" onClick={() => setToken(makeSample())} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane
          title="Token JWT"
          value={token}
          onChange={setToken}
          placeholder="Cole o token (eyJ…) aqui. “Bearer ” no início é ignorado."
          error={error}
          footer="A assinatura não é verificada: apenas decodificação."
        />
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumo</h2>
              {decoded && badge[state]}
            </div>
            {decoded && claims.length ? (
              <dl className="grid max-h-28 gap-x-4 gap-y-1 overflow-y-auto text-xs sm:grid-cols-[auto_1fr]">
                {claims.map(c => (
                  <div key={c.label} className="contents">
                    <dt className="font-code font-bold text-muted-foreground">{c.label}</dt>
                    <dd className="break-all font-medium text-foreground">{c.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">{decoded ? 'Nenhuma claim padrão (exp, iat, iss…) encontrada.' : 'Cole um token para ver expiração e claims.'}</p>
            )}
          </section>
          <ToolPane title={`Header${decoded?.header.alg ? ` · ${String(decoded.header.alg)}` : ''}`} value={decoded ? JSON.stringify(decoded.header, null, 2) : ''} readOnly placeholder="Header decodificado." />
          <ToolPane title="Payload" value={decoded ? JSON.stringify(decoded.payload, null, 2) : ''} readOnly placeholder="Payload decodificado." downloadName="payload.json" />
        </div>
      </div>
    </DevToolPage>
  );
}
