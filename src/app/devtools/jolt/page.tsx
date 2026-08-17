'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/layout/LoadingScreen';

export default function JoltSandboxRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/jolt/sandbox');
  }, [router]);

  return <LoadingScreen message="Redirecionando para o Jolt Sandbox..." />;
}
