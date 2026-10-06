import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sprint Review | Sprint Showcase | Portal Tech V&D',
  description: 'Visualize e apresente suas entregas de sprint de forma profissional e interativa. Sem slides, focado em resultados reais.',
  openGraph: {
    title: 'Sprint Showcase - Apresentação de Entrega Ágil',
    description: 'Transforme sua Sprint Review em um evento de elite com o Sprint Showcase do Portal Tech V&D.',
  }
};

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
