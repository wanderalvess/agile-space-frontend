export interface AppReleaseItem {
  id?: string;
  tag: string;
  title: string;
  description: string;
  changes: string[];
  type: 'major' | 'minor' | 'patch' | string;
  iconName?: string;
  iconClass?: string;
  icon?: {
    name: string;
    className: string;
  };
  displayDate?: string;
  date?: string;
  isPublished?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(errorText || `Erro na API Changelog (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function normalizeRelease(raw: any): AppReleaseItem {
  return {
    id: raw.id,
    tag: raw.tag,
    title: raw.title,
    description: raw.description,
    changes: Array.isArray(raw.changes) ? raw.changes : [],
    type: raw.type || 'patch',
    iconName: raw.iconName || (raw.icon?.name) || 'Sparkles',
    iconClass: raw.iconClass || (raw.icon?.className) || 'h-5 w-5 text-primary',
    icon: {
      name: raw.iconName || (raw.icon?.name) || 'Sparkles',
      className: raw.iconClass || (raw.icon?.className) || 'h-5 w-5 text-primary',
    },
    displayDate: raw.displayDate || raw.date,
    date: raw.displayDate || raw.date,
    isPublished: raw.isPublished !== false,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const changelogApi = {
  async getPublishedReleases(): Promise<AppReleaseItem[]> {
    const data = await req<any[]>('/changelog');
    return data.map(normalizeRelease);
  },

  async getLatestRelease(): Promise<AppReleaseItem | null> {
    try {
      const data = await req<any>('/changelog/latest');
      return data ? normalizeRelease(data) : null;
    } catch {
      return null;
    }
  },

  async getAdminReleases(): Promise<AppReleaseItem[]> {
    const data = await req<any[]>('/admin/changelog');
    return data.map(normalizeRelease);
  },

  async createRelease(item: Partial<AppReleaseItem>): Promise<AppReleaseItem> {
    const payload = {
      tag: item.tag,
      title: item.title,
      description: item.description,
      changes: item.changes,
      type: item.type,
      iconName: item.iconName || item.icon?.name,
      iconClass: item.iconClass || item.icon?.className,
      displayDate: item.displayDate || item.date,
      isPublished: item.isPublished,
      createdBy: item.createdBy,
    };
    const res = await req<any>('/admin/changelog', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeRelease(res);
  },

  async updateRelease(id: string, item: Partial<AppReleaseItem>): Promise<AppReleaseItem> {
    const payload = {
      tag: item.tag,
      title: item.title,
      description: item.description,
      changes: item.changes,
      type: item.type,
      iconName: item.iconName || item.icon?.name,
      iconClass: item.iconClass || item.icon?.className,
      displayDate: item.displayDate || item.date,
      isPublished: item.isPublished,
    };
    const res = await req<any>(`/admin/changelog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeRelease(res);
  },

  async deleteRelease(id: string): Promise<void> {
    return req<void>(`/admin/changelog/${id}`, { method: 'DELETE' });
  },

  async importLegacyReleases(items: any[]): Promise<{ imported: number; skipped: number; total: number }> {
    const payload = items.map((raw) => ({
      tag: raw.tag,
      title: raw.title,
      description: raw.description,
      changes: raw.changes,
      type: raw.type,
      iconName: typeof raw.icon === 'object' ? raw.icon.name : raw.iconName || 'Sparkles',
      iconClass: typeof raw.icon === 'object' ? raw.icon.className : raw.iconClass || 'h-5 w-5 text-primary',
      displayDate: raw.date || raw.displayDate,
      isPublished: true,
      createdBy: 'Legacy Import',
    }));

    return req<{ imported: number; skipped: number; total: number }>('/admin/changelog/import-legacy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
