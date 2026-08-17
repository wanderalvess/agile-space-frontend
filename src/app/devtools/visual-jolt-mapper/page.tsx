'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/layout/LoadingScreen';

export default function VisualJoltMapperRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/jolt/visual');
  }, [router]);

  return <LoadingScreen message="Redirecionando para o Mapeador Jolt..." />;
}
