import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { firebaseConfig } from '@/firebase/config';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// No Firebase App Hosting ou Vercel, o projectId pode vir via variável de ambiente.
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || firebaseConfig.projectId;
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

// Cacheado pelo próprio jose (respeita Cache-Control do endpoint do Google);
// module-level pra reaproveitar entre requisições no mesmo processo.
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * Verifica o ID token do Firebase Auth enviado no header Authorization
 * (Bearer <token>) sem depender do firebase-admin (que exigiria credenciais
 * de service account). Valida assinatura RS256 contra as chaves públicas do
 * Google, issuer, audience e expiração — o mesmo que o firebase-admin faz
 * por baixo dos panos. Usado pra proteger rotas de API que fariam fetch pra
 * fora (proxy Jira) e não devem ficar abertas a visitantes não autenticados.
 */
export async function requireAuth(req: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.error('[verify-auth] No Bearer token found in header:', authHeader);
    return null;
  }

  const tokenStr = match[1];

  try {
    const { payload } = await jwtVerify(tokenStr, jwks, {
      issuer: ISSUER,
      audience: PROJECT_ID,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) {
       console.error('[verify-auth] Payload sub is invalid:', payload.sub);
       return null;
    }
    return { uid: payload.sub };
  } catch (err: any) {
    console.error('[verify-auth] jwtVerify failed:', err?.message || err);
    
    // Fallback de debug e contorno local
    try {
      const decoded = decodeJwt(tokenStr);
      console.error(`[verify-auth] DEBUG -> Token Decoded AUD: ${decoded.aud} | Expected AUD: ${PROJECT_ID}`);
      console.error(`[verify-auth] DEBUG -> Token Decoded ISS: ${decoded.iss} | Expected ISS: ${ISSUER}`);
      
      // Contorno exclusivo para ambiente local (dev) com proxy corporativo bloqueando o JWKS
      if (process.env.NODE_ENV === 'development' && err?.message?.includes('fetch failed')) {
        const isExpired = decoded.exp ? Date.now() >= decoded.exp * 1000 : true;
        if (!isExpired && decoded.aud === PROJECT_ID && decoded.iss === ISSUER && typeof decoded.sub === 'string') {
          console.warn('[verify-auth] WARNING: Bypass de assinatura de JWT ativo (Apenas Localhost) devido a falha de rede (Proxy/IPv6).');
          return { uid: decoded.sub };
        }
      }
    } catch (e) {}

    return null;
  }
}
