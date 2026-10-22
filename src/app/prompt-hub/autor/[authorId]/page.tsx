'use client';

import { use } from 'react';
import { AuthorPage } from '@/components/prompt-hub/AuthorPage';

export default function AuthorRoutePage(props: { params: Promise<{ authorId: string }> }) {
  const { authorId } = use(props.params);
  return <AuthorPage authorId={authorId} />;
}
