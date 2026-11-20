import { redirect } from 'next/navigation';
import { legacyRedirectHref } from '@/lib/devtools/registry';

// Rota antiga: a ferramenta foi fundida (ou removida). O redirecionamento mantém links salvos funcionando.
export default function LegacyRedirectPage() {
  redirect(legacyRedirectHref('doc-generator'));
}
