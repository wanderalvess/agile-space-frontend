/**
 * @fileOverview Função utilitária para extrair dados de JSONs de configuração complexos.
 */

export interface ParsedLayout {
  joltSpec: any[];
  apiUrl: string;
  title: string;
  hasBase64Decode: boolean;
  fullConfig?: any;
}

export function parseIntegrationLayout(json: any): ParsedLayout {
  let joltSpec: any[] = [];
  let apiUrl = '';
  let title = '';
  let hasBase64Decode = false;

  try {
    const campos = json?.tabela?.campos || [];

    // 1. Extrair Jolt Spec
    const layoutTransformacao = campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
    if (layoutTransformacao?.valor) {
      joltSpec = Array.isArray(layoutTransformacao.valor) 
        ? layoutTransformacao.valor 
        : JSON.parse(layoutTransformacao.valor);
    }

    // 2. Extrair URL da API
    const layoutComunicacao = campos.find((c: any) => c.nome === 'LAYOUTCOMUNICACAO');
    if (layoutComunicacao?.valor?.request?.url?.raw) {
      apiUrl = layoutComunicacao.valor.request.url.raw;
    }

    // 3. Extrair Título
    const servico = campos.find((c: any) => c.nome === 'SERVICO');
    if (servico?.valor) {
      title = servico.valor;
    }

    // 4. Identificar decodificação Base64 (suporta ambos os nomes para retrocompatibilidade)
    hasBase64Decode = joltSpec.some((op: any) => op.operation === 'custom-decode' || op.operation === 'custom-totvs');

  } catch (error) {
    console.error('Erro ao processar layout de integração:', error);
  }

  return {
    joltSpec,
    apiUrl,
    title,
    hasBase64Decode,
    fullConfig: json
  };
}