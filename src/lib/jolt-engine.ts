import { applyJoltLocal, type JoltResult } from './jolt-lite';
import { transformJoltBackend } from '@/services/joltService';

export type JoltEngineMode = 'local' | 'java';

export interface TransformJoltOptions {
  engine?: JoltEngineMode;
  smartHubEnvelope?: boolean;
  sortKeys?: boolean;
}

export interface ExtendedJoltResult extends JoltResult {
  engine: JoltEngineMode;
  executionTimeMs?: number;
  serverError?: string;
}

/**
 * Executa a transformação Jolt localmente no cliente ou no motor oficial Java no backend.
 */
export async function transformJolt(
  inputData: any,
  joltSpec: any,
  options: TransformJoltOptions = { engine: 'local' }
): Promise<ExtendedJoltResult> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Se o modo selecionado for Java (Backend Bazaarvoice)
  if (options.engine === 'java') {
    try {
      const backendRes = await transformJoltBackend(inputData, joltSpec, {
        smartHubEnvelope: options.smartHubEnvelope ?? true,
        sortKeys: options.sortKeys ?? false,
      });

      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);

      if (!backendRes.success) {
        throw new Error(backendRes.error || 'Erro desconhecido retornado pelo servidor Java.');
      }

      return {
        outputData: backendRes.output,
        preProcessed: false,
        engine: 'java',
        executionTimeMs: backendRes.executionTimeMs || elapsed,
      };
    } catch (error: any) {
      console.warn('Falha no motor Java, fallback para local ou reportando erro:', error.message);
      throw error;
    }
  }

  // Modo Local (Browser JS Engine)
  try {
    const parsedInput = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
    let parsedSpec = typeof joltSpec === 'string' ? JSON.parse(joltSpec) : joltSpec;

    // Normalização: se for o objeto de layout completo, extrai o array LAYOUTTRANSFORMACAO
    if (parsedSpec && !Array.isArray(parsedSpec)) {
      let candidate: any = null;
      if (parsedSpec.tabela?.campos) {
        candidate = parsedSpec.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO')?.valor;
      } else if (Array.isArray(parsedSpec.campos)) {
        candidate = parsedSpec.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO')?.valor;
      } else if (parsedSpec.LAYOUTTRANSFORMACAO) {
        candidate = parsedSpec.LAYOUTTRANSFORMACAO;
      }

      if (candidate) {
        if (typeof candidate === 'string') {
          try { parsedSpec = JSON.parse(candidate); } catch { parsedSpec = candidate; }
        } else {
          parsedSpec = candidate;
        }
      }
    }

    if (!Array.isArray(parsedSpec)) {
      throw new Error('A especificação Jolt deve ser um array válido (LAYOUTTRANSFORMACAO).');
    }

    // Executa localmente para máxima velocidade e conformidade com padrões de mercado
    const localResult = applyJoltLocal(parsedInput, parsedSpec);
    const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);

    return {
      ...localResult,
      engine: 'local',
      executionTimeMs: elapsed,
    };
   
  } catch (error: any) {
    console.error('Erro no motor Jolt Local:', error);
    throw new Error(`Falha na transformação: ${error.message}`);
  }
}