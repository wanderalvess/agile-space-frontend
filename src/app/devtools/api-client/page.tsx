import { redirect } from 'next/navigation';

export default function ApiClientLegacyRedirect() {
  redirect('/devtools/api-snippets');
}
