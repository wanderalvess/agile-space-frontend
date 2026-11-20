'use client';

import { PageHeader, PageShell } from '@/components/page';
import { ThemeSettings } from '@/components/settings/ThemeSettings';

export default function ConfiguracoesPage() {
  return (
    <PageShell documentTitle="Configurações" width="narrow" contentClassName="gap-6">
      <PageHeader
        title="Configurações"
        module="settings"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Configurações' }]}
        subtitle="Preferências da sua conta."
      />

      <section aria-labelledby="cfg-aparencia" className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="cfg-aparencia" className="text-lg font-bold">
            Aparência
          </h2>
          <p className="text-sm text-muted-foreground">A escolha é sua: não muda a aparência para o resto da squad e fica salva neste navegador.</p>
        </div>

        <ThemeSettings idPrefix="cfg" />
      </section>
    </PageShell>
  );
}
