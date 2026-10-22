import { redirect } from 'next/navigation';
import { QA_REDIRECT_HREF } from '@/lib/devtools/registry';

// A Central de qualidade deixou de ser um módulo: virou o filtro "Qualidade" do DevTools.
// A rota continua viva para não quebrar links salvos.
export default function QaRedirectPage() {
  redirect(QA_REDIRECT_HREF);
}
