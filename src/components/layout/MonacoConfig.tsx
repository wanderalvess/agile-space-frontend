'use client';

import { loader } from '@monaco-editor/react';
import { useEffect } from 'react';

/**
 * Global configuration for Monaco Editor to avoid worker initialization errors
 * in Next.js / Turbopack environments.
 */
export function MonacoConfig() {
  useEffect(() => {
    // Configure Monaco to load workers from CDN to avoid "object Event" errors
    // which usually indicate a failure to load the worker file from the local build.
    loader.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs'
      }
    });
  }, []);

  return null;
}
