import type { Metadata, Viewport } from 'next';
import './globals.css';
import Script from 'next/script';
import { Toaster } from "@/components/ui/toaster"
// Boa parte do app (Prompt Hub, Knowledge, devtools) usa o toast do sonner, que
// precisa do próprio provider — o Toaster acima é o do Radix e só renderiza os
// toasts criados por useToast().
import { Toaster as SonnerToaster } from 'sonner'
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Header } from '@/components/layout/Header';
import { Calmaria } from '@/components/workspace/Calmaria';
import { UserProvider } from '@/context/UserContext';
import { IdentityGatekeeper } from '@/components/auth/IdentityGatekeeper';
import { GlobalAnnouncementListener } from '@/components/admin/GlobalAnnouncementListener';
import { MonacoConfig } from '../components/layout/MonacoConfig';
import { SystemConfigProvider } from '@/context/SystemConfigContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Outfit, Inter, JetBrains_Mono } from 'next/font/google';


const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  preload: false,
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Espaço Ágil | Acelerando seu fluxo, um card de cada vez',
  description: 'A plataforma definitiva para cerimônias ágeis, estimativas de poker, planejamento de sprint, reviews (showcase) e retrospectivas. Design Premium para times ambiciosos.',
  keywords: ['ágil', 'scrum', 'poker', 'sprint review', 'retrospectiva', 'espaço ágil', 'gestão de squads'],
  authors: [{ name: 'Agile Engineering Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`h-full ${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  var variant = localStorage.getItem('theme-variant') || 'default';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  document.documentElement.classList.add('theme-' + variant);
                } catch (e) {}
              })();
            `
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Espaço Ágil" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className="font-body antialiased bg-background text-foreground transition-colors duration-150" suppressHydrationWarning>
        <FirebaseClientProvider>
          <ThemeProvider>
            <SystemConfigProvider>
              <UserProvider>
                <IdentityGatekeeper>
                  <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
                    <Header />
                    <main className="flex flex-1 w-full overflow-x-hidden">{children}</main>
                    <GlobalAnnouncementListener />
                    <Calmaria />
                  </div>
                </IdentityGatekeeper>
              </UserProvider>
            </SystemConfigProvider>
            <MonacoConfig />
          </ThemeProvider>
        </FirebaseClientProvider>

        <Toaster />
        <SonnerToaster position="bottom-right" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
