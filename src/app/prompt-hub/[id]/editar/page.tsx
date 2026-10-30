'use client';

import { use } from 'react';
import { ItemEditor } from '@/components/prompt-hub/ItemEditor';

export default function EditPromptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  return <ItemEditor id={id} />;
}
