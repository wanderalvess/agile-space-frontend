'use client';

import { AlertTriangle, Megaphone, Wrench } from 'lucide-react';
import { announcementMeta } from '@/hooks/home/derive';
import type { AnnouncementKind } from '@/hooks/home/types';
import { useHomeAnnouncements } from '@/hooks/home/useHomeAnnouncements';
import { useNow } from '@/hooks/home/useHomeResource';
import { Notice } from './Notice';

const KIND: Record<AnnouncementKind, { label: string; icon: typeof Megaphone }> = {
  info: { label: 'Aviso', icon: Megaphone },
  important: { label: 'Importante', icon: AlertTriangle },
  maintenance: { label: 'Manutenção', icon: Wrench },
};

/** Aviso do portal no topo da Home. Sem aviso vigente (ou sem rede), não ocupa espaço. */
export function AnnouncementBanner() {
  const { announcement, dismiss } = useHomeAnnouncements();
  const now = useNow();
  if (!announcement) return null;

  const { label, icon } = KIND[announcement.kind];
  return (
    <Notice
      variant={announcement.kind}
      icon={icon}
      label={label}
      title={announcement.title}
      text={announcement.text}
      meta={announcementMeta(announcement, now)}
      action={announcement.learnMoreUrl ? { label: 'Saiba mais', href: announcement.learnMoreUrl } : undefined}
      onDismiss={() => void dismiss(announcement.id)}
    />
  );
}
