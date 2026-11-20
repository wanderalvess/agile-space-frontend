"use client";

import { Suspense } from 'react';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { ArticleEditor } from '@/components/knowledge/editor/ArticleEditor';

export default function KnowledgeAdminNewAssetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-background">
          <AgileSpinner size="md" />
        </div>
      }
    >
      <ArticleEditor />
    </Suspense>
  );
}
