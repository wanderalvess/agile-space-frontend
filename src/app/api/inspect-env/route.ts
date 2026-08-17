import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    firebaseKeys: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'not set',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'not set',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'not set'
    },
    envKeys: Object.keys(process.env).filter(k => k.toLowerCase().includes('firebase') || k.toLowerCase().includes('next_public'))
  });
}
