/**
 * @fileOverview Interface para o motor de transformação Jolt.
 * Utiliza processamento LOCAL de alta performance para garantir custo zero e privacidade.
 */

import { applyJoltLocal, type JoltResult } from './jolt-lite';

/**
 * Executa a transformação Jolt localmente no cliente.
 */
export async function transformJolt(inputData: any, joltSpec: any): Promise<JoltResult> {
  try {
    const parsedInput = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
    let parsedSpec = typeof joltSpec === 'string' ? JSON.parse(joltSpec) : joltSpec;

    // Normalização: se for o objeto de layout completo, extrai o array LAYOUTTRANSFORMACAO
    if (parsedSpec && !Array.isArray(parsedSpec) && parsedSpec.tabela?.campos) {
      const campoTransformacao = parsedSpec.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
      if (campoTransformacao?.valor) {
        parsedSpec = Array.isArray(campoTransformacao.valor)
          ? campoTransformacao.valor
          : JSON.parse(typeof campoTransformacao.valor === 'string' ? campoTransformacao.valor : JSON.stringify(campoTransformacao.valor));
      }
    }

    if (!Array.isArray(parsedSpec)) {
      throw new Error('A especificação Jolt deve ser um array válido (LAYOUTTRANSFORMACAO).');
    }

    // Executa localmente para máxima velocidade e conformidade com padrões de mercado
    return applyJoltLocal(parsedInput, parsedSpec);
   
  } catch (error: any) {
    console.error('Erro no motor Jolt Local:', error);
    throw new Error(`Falha na transformação: ${error.message}`);
  }
}