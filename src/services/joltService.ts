/**
 * joltService.ts
 * Serviço de integração com o motor de transformação JOLT e gestão de projetos no backend.
 */

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/**
 * Indica se há um backend configurado explicitamente via env.
 * Quando falso (sem NEXT_PUBLIC_API_URL), as chamadas de nuvem retornam
 * resultados vazios silenciosamente — evitando violações de CSP por tentar
 * atingir localhost em ambientes sem backend.
 */
export const isBackendConfigured = !!process.env.NEXT_PUBLIC_API_URL;

export interface JoltTransformOptions {
  smartHubEnvelope?: boolean;
  sortKeys?: boolean;
}

export interface JoltBackendTransformResult {
  success: boolean;
  output: any;
  executionTimeMs: number;
  error?: string;
  engine: string;
}

export interface JoltEngineInfo {
  engine: string;
  version: string;
  vendor: string;
  supportedOperations: string[];
  totvsSmartHubEnvelopeSupport: boolean;
}

/**
 * Lê a mensagem de erro de uma resposta HTTP do backend. O Spring devolve JSON
 * ({message}, {error}); isso não deve aparecer cru na tela.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  let msg = '';
  if (text) {
    try {
      const json = JSON.parse(text);
      msg = (typeof json?.message === 'string' && json.message) || (typeof json?.error === 'string' && json.error) || '';
    } catch {
      msg = text.length <= 300 && !text.trim().startsWith('<') ? text : '';
    }
  }
  return msg || `${fallback} (${res.status})`;
}

/**
 * Executa a transformação JOLT utilizando o motor oficial Java (Bazaarvoice) no backend.
 */
export async function transformJoltBackend(
  input: any,
  spec: any,
  options?: JoltTransformOptions
): Promise<JoltBackendTransformResult> {
  const payload = {
    input,
    spec,
    options: options || { smartHubEnvelope: true, sortKeys: false }
  };

  const res = await authFetch(`${API_BASE_URL}/jolt/transform`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao executar transformação JOLT no backend'));
  }

  return res.json();
}

/**
 * Consulta informações e disponibilidade do motor Java oficial no backend.
 */
export async function getBackendJoltEngineInfo(): Promise<JoltEngineInfo | null> {
  try {
    const res = await authFetch(`${API_BASE_URL}/jolt/engine-info`, {
      method: 'GET',
    });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

// ── Gestão de Projetos JOLT na Nuvem (PostgreSQL) ──────────────────────────

export interface JoltProject {
  id: string;
  name: string;
  description?: string;
  category?: string;
  entityName?: string;
  mappingMode?: 'smarthub' | 'direct';
  isPublic?: boolean;
  authorId: string;
  authorName?: string;
  authorEmail?: string;
  squadId?: string;
  inputJson?: string;
  targetJson?: string;
  specJson?: string;
  flowNodes?: string;
  flowEdges?: string;
  versionCount?: number;
  /** Versão de edição (lock otimista): devolvida em expectedVersion ao salvar. */
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface JoltProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  commitMessage?: string;
  specJson?: string;
  flowNodes?: string;
  flowEdges?: string;
  inputJson?: string;
  targetJson?: string;
  createdBy?: string;
  authorName?: string;
  createdAt: string;
}

export interface SaveJoltProjectPayload {
  name: string;
  description?: string;
  category?: string;
  entityName?: string;
  mappingMode?: 'smarthub' | 'direct';
  isPublic?: boolean;
  squadId?: string;
  inputJson?: string;
  targetJson?: string;
  specJson?: string;
  flowNodes?: string;
  flowEdges?: string;
  commitMessage?: string;
  /** Versão que o cliente carregou; se o projeto já mudou, o servidor responde 409 em vez de sobrescrever. */
  expectedVersion?: number;
}

/**
 * Lista todos os projetos JOLT acessíveis ao usuário atual no backend.
 */
export async function listJoltProjects(search?: string): Promise<JoltProject[]> {
  if (!isBackendConfigured) return [];

  const params = new URLSearchParams();
  if (search) params.append('search', search);

  const res = await authFetch(`${API_BASE_URL}/jolt/projects?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao listar projetos JOLT'));
  }
  return res.json();
}

/**
 * Obtém detalhes completos de um projeto JOLT específico.
 */
export async function getJoltProject(id: string): Promise<JoltProject> {
  if (!isBackendConfigured) throw new Error('Backend não configurado.');

  const res = await authFetch(`${API_BASE_URL}/jolt/projects/${id}`);
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao carregar projeto JOLT'));
  }
  return res.json();
}

/**
 * Cria um novo projeto JOLT na nuvem.
 */
export async function createJoltProject(payload: SaveJoltProjectPayload): Promise<JoltProject> {
  if (!isBackendConfigured) throw new Error('Backend não configurado.');

  const res = await authFetch(`${API_BASE_URL}/jolt/projects`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao salvar projeto JOLT'));
  }
  return res.json();
}

/**
 * Atualiza um projeto JOLT existente (gerando versão se commitMessage estiver preenchida).
 */
export async function updateJoltProject(id: string, payload: SaveJoltProjectPayload): Promise<JoltProject> {
  if (!isBackendConfigured) throw new Error('Backend não configurado.');

  const res = await authFetch(`${API_BASE_URL}/jolt/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao atualizar projeto JOLT'));
  }
  return res.json();
}

/**
 * Exclui um projeto JOLT na nuvem.
 */
export async function deleteJoltProject(id: string): Promise<void> {
  if (!isBackendConfigured) throw new Error('Backend não configurado.');

  const res = await authFetch(`${API_BASE_URL}/jolt/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao excluir projeto JOLT'));
  }
}

/**
 * Lista o histórico de versões de um projeto JOLT.
 */
export async function listJoltProjectVersions(projectId: string): Promise<JoltProjectVersion[]> {
  if (!isBackendConfigured) return [];

  const res = await authFetch(`${API_BASE_URL}/jolt/projects/${projectId}/versions`);
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao listar versões do projeto'));
  }
  return res.json();
}

/**
 * Restaura o projeto para uma versão anterior (Rollback).
 */
export async function rollbackJoltProjectVersion(projectId: string, versionId: string): Promise<JoltProject> {
  if (!isBackendConfigured) throw new Error('Backend não configurado.');

  const res = await authFetch(`${API_BASE_URL}/jolt/projects/${projectId}/rollback/${versionId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Erro ao restaurar a versão'));
  }
  return res.json();
}

