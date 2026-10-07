"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/layout/LoadingScreen';

export default function ProjectsGovernancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=governance');
  }, [router]);

  return <LoadingScreen />;
}
