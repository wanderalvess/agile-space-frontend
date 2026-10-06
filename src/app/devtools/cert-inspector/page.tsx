'use client';

import { useMemo, useState } from 'react';
import forge from 'node-forge';
import { Check, Copy, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';

interface Info {
  subject: string;
  issuer: string;
  selfSigned: boolean;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  daysRemaining: number;
  signatureAlgorithm: string;
  publicKey: string;
  sans: string[];
  keyUsage: string[];
  isCA: boolean | null;
  sha256: string;
  sha1: string;
}

const dn = (attrs: forge.pki.CertificateField[]) => attrs.map(a => `${a.shortName ?? a.name}=${String(a.value)}`).join(', ');
const colon = (hex: string) => hex.toUpperCase().match(/.{1,2}/g)?.join(':') ?? hex;

// Parse REAL com node-forge (o legado exibia dados fixos simulados).
function inspect(pem: string): Info {
  const cert = forge.pki.certificateFromPem(pem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const pk = cert.publicKey as forge.pki.rsa.PublicKey & { n?: { bitLength(): number } };

  const sans: string[] = [];
  const ku: string[] = [];
  let isCA: boolean | null = null;
  for (const ext of cert.extensions as Array<Record<string, unknown>>) {
    if (ext.name === 'subjectAltName') {
      for (const an of (ext.altNames as Array<{ type: number; value?: string; ip?: string }>) ?? []) {
        // 2=DNS, 7=IP, 1=e-mail, 6=URI
        sans.push(`${an.type === 2 ? 'DNS' : an.type === 7 ? 'IP' : an.type === 1 ? 'E-mail' : an.type === 6 ? 'URI' : 'Outro'}: ${an.value ?? an.ip ?? ''}`);
      }
    } else if (ext.name === 'keyUsage') {
      for (const k of ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign']) if (ext[k]) ku.push(k);
    } else if (ext.name === 'basicConstraints') {
      isCA = Boolean(ext.cA);
    }
  }

  const subject = dn(cert.subject.attributes);
  const issuer = dn(cert.issuer.attributes);
  const oid = cert.siginfo?.algorithmOid ?? cert.signatureOid;
  const keyBits = pk.n ? `RSA ${pk.n.bitLength()} bits` : 'Chave não-RSA (EC/outra)';

  return {
    subject, issuer, selfSigned: subject === issuer,
    serial: colon(cert.serialNumber),
    notBefore: cert.validity.notBefore, notAfter: cert.validity.notAfter,
    daysRemaining: Math.floor((cert.validity.notAfter.getTime() - Date.now()) / 86_400_000),
    signatureAlgorithm: (forge.pki.oids as Record<string, string>)[oid] ?? oid,
    publicKey: keyBits, sans, keyUsage: ku, isCA,
    sha256: colon(forge.md.sha256.create().update(der).digest().toHex()),
    sha1: colon(forge.md.sha1.create().update(der).digest().toHex()),
  };
}

// Gera um certificado autoassinado de exemplo (RSA 2048 leva ~1s; usamos 1024 só para demonstração).
function makeSample(): string {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01a2b3c4';
  cert.validity.notBefore = new Date(Date.now() - 30 * 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 335 * 86_400_000);
  const attrs = [{ name: 'commonName', value: 'exemplo.local' }, { name: 'organizationName', value: 'Portal Tech V&D' }, { name: 'countryName', value: 'BR' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'exemplo.local' }, { type: 2, value: 'www.exemplo.local' }] },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

const fmt = (d: Date) => d.toLocaleString('pt-BR');

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-border/60 px-3 py-2 last:border-0 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={cn('break-all text-xs font-medium text-foreground', mono && 'font-code')}>{children}</dd>
    </div>
  );
}

function CopyHash({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Row label={label} mono>
      <span className="flex items-start gap-2">
        <span className="flex-1">{value}</span>
        <Button
          type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Copiar ${label}`}
          onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* sem permissão */ } }}
        >
          {done ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </span>
    </Row>
  );
}

export default function CertInspectorPage() {
  const [pem, setPem] = useState('');

  const { info, error } = useMemo(() => {
    if (!pem.trim()) return { info: null as Info | null, error: null as string | null };
    if (!pem.includes('BEGIN CERTIFICATE')) return { info: null, error: 'Formato inválido: inclua as linhas BEGIN CERTIFICATE / END CERTIFICATE (PEM).' };
    try { return { info: inspect(pem.trim()), error: null }; }
    catch { return { info: null, error: 'Não foi possível ler o certificado: o PEM está incompleto ou corrompido.' }; }
  }, [pem]);

  const status = info ? (info.daysRemaining < 0 ? 'expired' : info.daysRemaining <= 30 ? 'soon' : 'ok') : null;

  return (
    <DevToolPage
      toolId="cert-inspector"
      actions={
        <Button variant="outline" size="sm" onClick={() => setPem(makeSample())} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane title="Certificado PEM" value={pem} onChange={setPem} placeholder={'-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----'} error={error} footer="Lido localmente; apenas o primeiro certificado do arquivo é analisado." />
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detalhes</h2>
            {status === 'ok' && <Badge className="bg-primary text-[10px] font-black uppercase text-primary-foreground">Válido · {info!.daysRemaining} dias</Badge>}
            {status === 'soon' && <Badge variant="outline" className="text-[10px] font-black uppercase">Expira em {info!.daysRemaining} dias</Badge>}
            {status === 'expired' && <Badge variant="destructive" className="text-[10px] font-black uppercase">Expirado há {-info!.daysRemaining} dias</Badge>}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {info ? (
              <dl>
                <Row label="Subject">{info.subject}</Row>
                <Row label="Emissor">{info.issuer}{info.selfSigned && <Badge variant="secondary" className="ml-2 text-[10px]">autoassinado</Badge>}</Row>
                <Row label="Validade">{fmt(info.notBefore)} → {fmt(info.notAfter)}</Row>
                <Row label="Nº de série" mono>{info.serial}</Row>
                <Row label="Assinatura">{info.signatureAlgorithm}</Row>
                <Row label="Chave pública">{info.publicKey}</Row>
                <Row label="CA">{info.isCA === null ? 'Não informado' : info.isCA ? 'Sim' : 'Não'}</Row>
                <Row label="Uso da chave">{info.keyUsage.length ? info.keyUsage.join(', ') : '—'}</Row>
                <Row label="SANs">{info.sans.length ? <ul className="space-y-0.5">{info.sans.map(s => <li key={s}>{s}</li>)}</ul> : '—'}</Row>
                <CopyHash label="SHA-256" value={info.sha256} />
                <CopyHash label="SHA-1" value={info.sha1} />
              </dl>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Cole um certificado PEM para ver emissor, validade e nomes alternativos.</p>
            )}
          </div>
        </section>
      </div>
    </DevToolPage>
  );
}
