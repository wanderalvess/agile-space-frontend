import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sprint Review | Sprint Showcase | Espaço Ágil',
  description: 'Visualize e apresente suas entregas de sprint de forma profissional e interativa. Sem slides, focado em resultados reais.',
  openGraph: {
    title: 'Sprint Showcase - Apresentação de Entrega Ágil',
    description: 'Transforme sua Sprint Review em um evento de elite com o Sprint Showcase do Espaço Ágil.',
  }
};

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
