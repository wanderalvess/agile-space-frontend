'use client';

import React from 'react';
import { PromptSpecimenCard } from './PromptSpecimenCard';
import { PromptItem } from '../types';

export interface PromptCardProps {
  prompt: PromptItem;
  isOwner: boolean;
  isReadOnly?: boolean;
  featured?: boolean;
  onFork: (prompt: PromptItem) => void;
  onEdit?: (prompt: PromptItem) => void;
  onView?: (prompt: PromptItem) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  /** Clique numa tag aplica o filtro correspondente no catálogo. */
  onSelectTag?: (tag: string) => void;
  /** Chamado após a cópia dar certo, para contabilizar o uso. */
  onCopy?: (id: string) => void;
  /** Abre o perfil de quem publicou. */
  onSelectAuthor?: (authorId: string) => void;
}

export function PromptCard(props: PromptCardProps) {
  return <PromptSpecimenCard {...props} />;
}
