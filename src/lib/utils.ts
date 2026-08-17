import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatExternalUrl = (url?: string) => {
  if (!url) return '#';
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
};

/**
 * Normaliza um link externo digitado pelo usuário e devolve null quando o
 * esquema não é http(s). Bloqueia javascript:, data:, file: e similares antes
 * que cheguem a window.open/href — links vindos de conteúdo compartilhado não
 * são confiáveis. Sem esquema, assume https.
 */
export const toSafeExternalUrl = (url?: string): string | null => {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);

  try {
    const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

/** Abre um link externo em nova aba sem expor window.opener à página de destino. */
export const openExternalUrl = (url?: string): boolean => {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) return false;
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
};

export const getRoomInitials = (name?: string) => {
  if (!name) return '#';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const isValidJiraKey = (key?: string | null) => {
  if (!key) return false;
  // Patterns like PROJ-123 (Uppercase letters and numbers, hyphen, then digits)
  return /^[A-Z0-9]+-\d+$/.test(key);
};
