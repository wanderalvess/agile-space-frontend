import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTopicById, MANUAL_TOPICS } from '../data/topics';
import { TOPIC_COMPONENTS } from '../content';

interface Props {
  params: Promise<{ topic: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const item = getTopicById(topic);

  if (!item) {
    return {
      title: 'Tópico Não Encontrado | Manual Espaço Ágil'
    };
  }

  return {
    title: `${item.title} - ${item.subtitle} | Manual de Operações`,
    description: item.description,
  };
}

export function generateStaticParams() {
  return MANUAL_TOPICS.map((topic) => ({
    topic: topic.id,
  }));
}

export default async function ManualTopicPage({ params }: Props) {
  const { topic } = await params;
  const item = getTopicById(topic);

  if (!item) {
    notFound();
  }

  const Component = TOPIC_COMPONENTS[topic];

  if (!Component) {
    notFound();
  }

  return <Component />;
}
