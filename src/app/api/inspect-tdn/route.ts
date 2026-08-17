import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

import { firebaseConfig } from '@/firebase/config';


export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);

    // 1. Obter um UID de autor a partir de knowledge_kb
    const kbSnapshot = await getDocs(collection(db, 'knowledge_kb'));
    let authorId = '';
    
    for (const docItem of kbSnapshot.docs) {
      if (docItem.data().authorId) {
        authorId = docItem.data().authorId;
        break;
      }
    }

    if (!authorId) {
      return NextResponse.json({ 
        error: 'Nenhum documento encontrado em knowledge_kb para extrair o authorId/UID.' 
      }, { status: 200 });
    }

    // 2. Buscar as configurações do TDN diretamente usando o UID do autor
    const tdnConfigRef = doc(db, 'users', authorId, 'config', 'tdn');
    const tdnSnap = await getDoc(tdnConfigRef);
    
    if (!tdnSnap.exists() || !tdnSnap.data().token) {
      return NextResponse.json({ 
        error: 'Configurações do TDN não encontradas para o autor.',
        authorId,
        hasConfigDoc: tdnSnap.exists(),
        configData: tdnSnap.exists() ? tdnSnap.data() : null
      }, { status: 200 });
    }

    const baseUrl = tdnSnap.data().baseUrl || 'tdn.totvs.com.br';
    const token = tdnSnap.data().token;
    const cleanBaseUrl = baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    
    // URLs para buscar as duas páginas
    const pageIdNotShowing = '846870176';
    const pageIdShowing = '632097966';

    const fetchPageMeta = async (pageId: string) => {
      const url = `https://${cleanBaseUrl}/rest/api/content/${pageId}?expand=space,history,metadata.labels`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}`, details: (await response.text()).substring(0, 300) };
      }
      return await response.json();
    };

    const metaNotShowing = await fetchPageMeta(pageIdNotShowing);
    const metaShowing = await fetchPageMeta(pageIdShowing);

    return NextResponse.json({
      success: true,
      authorId,
      tdnSettings: {
        baseUrl,
        space: tdnSnap.data().space || null,
        label: tdnSnap.data().label || null,
      },
      page_846870176_not_showing: {
        id: metaNotShowing.id || null,
        title: metaNotShowing.title || null,
        space: metaNotShowing.space ? { key: metaNotShowing.space.key, name: metaNotShowing.space.name } : null,
        labels: metaNotShowing.metadata?.labels?.results?.map((l: any) => l.name) || [],
        error: metaNotShowing.error || null,
      },
      page_632097966_showing: {
        id: metaShowing.id || null,
        title: metaShowing.title || null,
        space: metaShowing.space ? { key: metaShowing.space.key, name: metaShowing.space.name } : null,
        labels: metaShowing.metadata?.labels?.results?.map((l: any) => l.name) || [],
        error: metaShowing.error || null,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}
