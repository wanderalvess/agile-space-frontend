import { parseLayoutData, parseLayoutText } from '@/lib/jolt-maintenance';

export type ModelName = 'shift' | 'modify' | 'default' | 'cardinality' | 'remove';

/** Modelos de operação do menu "Modelos": cada um SUBSTITUI o conteúdo do editor de spec. */
export const MODEL_SPECS: Record<ModelName, unknown[]> = {
  shift: [{ operation: 'shift', spec: { campoOrigem: 'campoDestino' } }],
  modify: [{ operation: 'modify-overwrite-beta', spec: { codigo: '=toInteger', idExterno: "=concat('id-', @(1,codigo))" } }],
  default: [{ operation: 'default', spec: { status: 'ATIVO' } }],
  cardinality: [{ operation: 'cardinality', spec: { listaOuObjeto: 'ONE' } }],
  remove: [{ operation: 'remove', spec: { campoRemover: '' } }],
};

export const MODEL_MENU: { name: ModelName; description: string }[] = [
  { name: 'shift', description: 'Mover e renomear campos' },
  { name: 'modify', description: 'Converter tipos e valores' },
  { name: 'default', description: 'Preencher valores padrão' },
  { name: 'cardinality', description: 'Lista ou valor único' },
  { name: 'remove', description: 'Remover campos da saída' },
];

export const modelSpecText = (name: ModelName): string => JSON.stringify(MODEL_SPECS[name], null, 2);

/** Nome seguro para arquivo: tira o que o sistema de arquivos não aceita. */
export function safeFileName(name: string): string {
  return (name || 'layout').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'layout';
}

export type FullLayoutResult = { ok: true; text: string } | { ok: false; title: string; description: string };

/**
 * Layout completo para levar de volta ao arquivo: o colado inteiro, ou o do GitHub com a spec editada.
 * `loadedDocument` é o arquivo inteiro carregado (o editor mostra só a transformação).
 */
export function buildFullLayout(specText: string, loadedDocument: unknown): FullLayoutResult {
  const current = parseLayoutText(specText);
  if (!current.ok) return { ok: false, title: 'Spec inválida', description: current.error };
  if (current.parts.kind === 'envelope') return { ok: true, text: JSON.stringify(JSON.parse(specText), null, 2) };
  if (loadedDocument) {
    const base = parseLayoutData(loadedDocument);
    if (base.ok) return { ok: true, text: JSON.stringify(base.parts.rebuild(current.parts.spec), null, 2) };
  }
  return {
    ok: false,
    title: 'Sem layout completo',
    description: 'Carregue uma rota do GitHub ou cole o layout inteiro (com tabela.campos) no editor para exportar o arquivo completo.',
  };
}

/** Texto que identifica o estado salvo/não salvo de um layout (nome, URL, spec e entrada). */
export function layoutSnapshot(parts: { name: string; url: string; spec: string; input: string }): string {
  return JSON.stringify([parts.name.trim(), parts.url.trim(), parts.spec, parts.input]);
}
