'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SpotifyCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workspace');
  }, [router]);

  return null;
}
