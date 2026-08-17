'use client';

import { useEffect } from 'react';

export default function SpotifyCallbackPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      
      if (token) {
        // Notify parent/opener window
        if (window.opener) {
          try {
            window.opener.postMessage(
              { type: 'SPOTIFY_AUTH_SUCCESS', token },
              window.location.origin
            );
            window.close();
          } catch (e) {
            console.error('Error sending message to opener:', e);
            // Fallback direct redirection if communication fails
            localStorage.setItem('spotify_token_direct', token);
            window.location.href = '/workspace';
          }
        } else {
          // Fallback if not opened in a popup: save and redirect
          localStorage.setItem('spotify_token_direct', token);
          window.location.href = '/workspace';
        }
      }
    } else {
      // If no hash, wait a bit or redirect
      const timeout = setTimeout(() => {
        window.location.href = '/workspace';
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa] dark:bg-slate-950 font-sans p-6 text-center">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
        Conectando sua conta...
      </h2>
      <p className="text-[10px] font-semibold text-slate-500 mt-2">
        Esta janela fechará automaticamente em instantes.
      </p>
    </div>
  );
}
