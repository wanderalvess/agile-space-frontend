'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';

/**
 * Estima o offset (ms) entre o relógio do servidor Firestore e o relógio local
 * deste cliente: `offset = serverNow - localNow`. Faz um round-trip único
 * gravando um serverTimestamp no próprio doc de participante e lendo o valor
 * resolvido, usando o ponto médio do round-trip como estimativa do "agora"
 * local correspondente.
 *
 * Uso: para o countdown do timer ser igual em todos os clientes, o endTime é
 * gravado em epoch de SERVIDOR (localNow + offset + duração) e cada cliente
 * calcula o restante como `endTime - (Date.now() + offset)`. Assim o skew de
 * relógio entre participantes deixa de afetar a contagem.
 *
 * Falha silenciosa => offset 0 (comportamento antigo, baseado no relógio local).
 */
export function useServerTimeOffset(firestore: Firestore | null | undefined, uid: string | undefined): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!firestore || !uid) return;
    let cancelled = false;

    (async () => {
      try {
        const ref = doc(firestore, 'participants', uid);
        const before = Date.now();
        await updateDoc(ref, { _clockPing: serverTimestamp() });
        const snap = await getDoc(ref);
        const after = Date.now();
        const ts = snap.get('_clockPing');
        if (!cancelled && ts instanceof Timestamp) {
          const serverMs = ts.toMillis();
          const localMid = (before + after) / 2;
          setOffset(serverMs - localMid);
        }
      } catch {
        // Sem permissão/rede: mantém offset 0 (fallback = relógio local).
      }
    })();

    return () => { cancelled = true; };
  }, [firestore, uid]);

  return offset;
}
