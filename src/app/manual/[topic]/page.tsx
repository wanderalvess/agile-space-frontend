import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TopicPage } from '../components/TopicPage';
import { TOPIC_CONTENT } from '../content';
import { getTopicById, MANUAL_TOPICS } from '../data/topics';

interface Props {
  params: Promise<{ topic: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const item = getTopicById(topic);

  if (!item) {
    return { title: 'Tópico não encontrado - Manual | Portal Tech V&D' };
  }

  return {
    title: `${item.title} - Manual | Portal Tech V&D`,
    description: item.summary,
  };
}

export function generateStaticParams() {
  return MANUAL_TOPICS.map((topic) => ({ topic: topic.id }));
}

export default async function ManualTopicPage({ params }: Props) {
  const { topic } = await params;
  const item = getTopicById(topic);
  const blocks = TOPIC_CONTENT[topic];

  if (!item || !blocks) {
    notFound();
  }

  return <TopicPage topic={item} blocks={blocks} />;
}
