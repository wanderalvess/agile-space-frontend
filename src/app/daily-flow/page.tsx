'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/layout/LoadingScreen';

export default function DailyFlowPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/squad?tab=daily');
  }, [router]);

  return <LoadingScreen />;
}
