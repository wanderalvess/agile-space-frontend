import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  allowedDevOrigins: ['10.62.24.75'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.googleapis.com https://apis.google.com https://cdn.jsdelivr.net;
      worker-src 'self' blob: data: 'unsafe-inline' https://cdn.jsdelivr.net;
      connect-src 'self' http://localhost:* ws://localhost:* https://ipapi.co https://*.googleapis.com https://cdn.jsdelivr.net https://api.github.com https://raw.githubusercontent.com https://lh3.googleusercontent.com https://dl.dropboxusercontent.com https://images.unsplash.com https://picsum.photos https://placehold.co;
      img-src 'self' blob: data: https://images.unsplash.com https://picsum.photos https://placehold.co https://lh3.googleusercontent.com https://dl.dropboxusercontent.com;
      media-src 'self' https: data: blob:;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net;
      font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-src 'self' https://*.google.com;
      frame-ancestors 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
