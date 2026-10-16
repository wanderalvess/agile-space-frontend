'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * QR code do link da sala, gerado no navegador (a URL nunca sai dele). Fundo
 * branco fixo: QR precisa de contraste próprio, independente do tema.
 */
export function RoomQr({ url, size = 112, className }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = React.useState<string>('');
  React.useEffect(() => {
    if (!url) return;
    let alive = true;
    import('qrcode')
      .then((m) => m.toDataURL(url, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' }))
      .then((data) => { if (alive) setSrc(data); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [url, size]);

  const box = cn('shrink-0 rounded-[10px] bg-white p-2 shadow-[0_0_24px_hsl(var(--primary)/0.2)] [.theme-leitura_&]:shadow-none', className);
  if (!src) {
    return <div style={{ width: size, height: size }} className={cn(box, 'motion-safe:animate-pulse')} aria-hidden="true" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR code para entrar na sala" className={box} />;
}
