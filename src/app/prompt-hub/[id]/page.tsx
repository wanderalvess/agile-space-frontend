'use client';

import { use } from 'react';
import { ItemPage } from '@/components/prompt-hub/ItemPage';

export default function SharedPromptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  return <ItemPage id={id} />;
}
