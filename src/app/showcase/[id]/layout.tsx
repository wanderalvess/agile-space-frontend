import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Review | Portal Tech V&D',
  description: 'Prepare e apresente as entregas da sprint direto dos cards, sem slides e com o aceite do PO registrado na cerimônia.',
  openGraph: {
    title: 'Review - Apresentação das entregas da sprint',
    description: 'Apresente as entregas da sprint com evidências e o aceite do PO no Portal Tech V&D.',
  }
};

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
