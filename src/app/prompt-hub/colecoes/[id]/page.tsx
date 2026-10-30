'use client';

import { use } from 'react';
import { CollectionDetail } from '@/components/prompt-hub/CollectionDetail';

export default function CollectionDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  return <CollectionDetail id={id} />;
}
