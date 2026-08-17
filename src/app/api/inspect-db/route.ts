import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

import { firebaseConfig } from '@/firebase/config';


export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    
    // Lista de coleções comuns para checar
    const collectionsToCheck = [
      'users',
      'knowledge_kb',
      'knowledge_conversations',
      'knowledge_user_configs',
      'settings'
    ];

    const results: any = {};

    for (const colName of collectionsToCheck) {
      try {
        const snap = await getDocs(collection(db, colName));
        results[colName] = {
          exists: true,
          size: snap.size,
          docs: snap.docs.map(d => ({ id: d.id, keys: Object.keys(d.data()) })).slice(0, 5)
        };
      } catch (e: any) {
        results[colName] = {
          exists: false,
          error: e.message
        };
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
