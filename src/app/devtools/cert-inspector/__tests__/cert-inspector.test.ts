import { describe, it, expect, beforeAll } from 'vitest';
import forge from 'node-forge';
import { parseCertificate } from '../page';

// Chave reaproveitada entre os fixtures — tamanho pequeno só pra manter o teste rápido,
// não representa uso real (a ferramenta em si não valida força de chave).
let keys: forge.pki.rsa.KeyPair;

function makeCertPem(opts: {
  subjectAttrs: forge.pki.CertificateField[];
  issuerAttrs: forge.pki.CertificateField[];
  notBefore: Date;
  notAfter: Date;
}): string {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = opts.notBefore;
  cert.validity.notAfter = opts.notAfter;
  cert.setSubject(opts.subjectAttrs);
  cert.setIssuer(opts.issuerAttrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

const LEAF = [
  { shortName: 'CN', value: 'app.empresa.com.br' },
  { shortName: 'O', value: 'Empresa Squad' },
];
const CA = [
  { shortName: 'CN', value: 'app.empresa.com.br' }, // mesmo CN do leaf, CA diferente
  { shortName: 'O', value: 'Empresa CA Corporativa' },
];

describe('cert-inspector/parseCertificate - Inspeção Técnica de Certificados X.509', () => {
  beforeAll(() => {
    keys = forge.pki.rsa.generateKeyPair(512);
  });

  it('reconhece um certificado válido, ainda não expirado e não autoassinado', () => {
    const now = new Date();
    const pem = makeCertPem({
      subjectAttrs: LEAF,
      issuerAttrs: CA,
      notBefore: new Date(now.getTime() - 86400000),
      notAfter: new Date(now.getTime() + 30 * 86400000),
    });

    const result = parseCertificate(pem);

    expect(result.validity.isExpired).toBe(false);
    expect(result.validity.isNotYetValid).toBe(false);
    expect(result.validity.isSelfSigned).toBe(false);
  });

  it('marca como expirado um certificado cujo notAfter já passou', () => {
    const now = new Date();
    const pem = makeCertPem({
      subjectAttrs: LEAF,
      issuerAttrs: CA,
      notBefore: new Date(now.getTime() - 60 * 86400000),
      notAfter: new Date(now.getTime() - 10 * 86400000),
    });

    const result = parseCertificate(pem);

    expect(result.validity.isExpired).toBe(true);
    expect(result.validity.isNotYetValid).toBe(false);
  });

  it('marca como "ainda não válido" (não como expirado) um certificado com notBefore no futuro', () => {
    const now = new Date();
    const pem = makeCertPem({
      subjectAttrs: LEAF,
      issuerAttrs: CA,
      notBefore: new Date(now.getTime() + 10 * 86400000),
      notAfter: new Date(now.getTime() + 40 * 86400000),
    });

    const result = parseCertificate(pem);

    expect(result.validity.isNotYetValid).toBe(true);
    expect(result.validity.isExpired).toBe(false);
    expect(result.validity.daysUntilValid).toBeGreaterThan(0);
  });

  it('não marca como autoassinado um certificado emitido por CA com o mesmo CN mas DN diferente', () => {
    const now = new Date();
    const pem = makeCertPem({
      subjectAttrs: LEAF,
      issuerAttrs: CA, // mesmo CN de LEAF, mas Organization diferente
      notBefore: new Date(now.getTime() - 86400000),
      notAfter: new Date(now.getTime() + 30 * 86400000),
    });

    const result = parseCertificate(pem);

    expect(result.subject.commonName).toBe(result.issuer.commonName);
    expect(result.validity.isSelfSigned).toBe(false);
  });

  it('marca como autoassinado quando subject e issuer têm o DN completo idêntico', () => {
    const now = new Date();
    const pem = makeCertPem({
      subjectAttrs: LEAF,
      issuerAttrs: LEAF,
      notBefore: new Date(now.getTime() - 86400000),
      notAfter: new Date(now.getTime() + 30 * 86400000),
    });

    const result = parseCertificate(pem);

    expect(result.validity.isSelfSigned).toBe(true);
  });

  it('lança erro para um PEM inválido', () => {
    expect(() => parseCertificate('não é um certificado')).toThrow();
  });
});
