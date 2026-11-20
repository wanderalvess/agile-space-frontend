'use client';

import { use } from 'react';
import { CollectionEditor } from '@/components/prompt-hub/CollectionEditor';

export default function EditCollectionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  return <CollectionEditor id={id} />;
}
