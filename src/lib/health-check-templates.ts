import { HealthCheckDimension, HealthCheckScaleType } from './types';

export interface HealthCheckTemplate {
  id: string;
  name: string;
  description: string;
  defaultScale: HealthCheckScaleType;
  dimensions: HealthCheckDimension[];
}

export const HEALTH_CHECK_TEMPLATES: HealthCheckTemplate[] = [
  {
    id: 'spotify',
    name: 'Modelo Spotify (Clássico)',
    description: 'O padrão ouro para medir saúde de squads. Focado em autonomia, suporte e valor.',
    defaultScale: 'traffic_light',
    dimensions: [
      { key: 'support', title: 'Apoio e Suporte', description: 'Recebemos a ajuda necessária de fora do time?' },
      { key: 'teamwork', title: 'Trabalho em Equipe', description: 'Colaboramos bem e nos ajudamos internamente?' },
      { key: 'code_quality', title: 'Qualidade do Código', description: 'Temos orgulho da qualidade do que construímos?' },
      { key: 'value', title: 'Entrega de Valor', description: 'Estamos entregando valor real para nossos clientes?' },
      { key: 'speed', title: 'Velocidade', description: 'Conseguimos entregar rápido sem impedimentos?' },
      { key: 'fun', title: 'Diversão/Moral', description: 'Nós nos divertimos trabalhando juntos e estamos motivados?' },
      { key: 'processes', title: 'Processos', description: 'Nossos processos nos ajudam ou nos atrapalham?' },
      { key: 'mission', title: 'Missão Clara', description: 'Entendemos e acreditamos no nosso propósito?' },
    ]
  },
  {
    id: 'scrum_maturity',
    name: 'Maturidade Scrum',
    description: 'Avalie a eficácia das cerimônias e papéis do Scrum no dia a dia.',
    defaultScale: 'numbers_5',
    dimensions: [
      { key: 'planning', title: 'Sprint Planning', description: 'Nossos planejamentos são eficazes e saímos com metas claras?' },
      { key: 'daily', title: 'Daily Scrum', description: 'As dailies nos ajudam a alinhar o trabalho ou são apenas status report?' },
      { key: 'review', title: 'Sprint Review', description: 'Recebemos feedback real dos stakeholders durante a review?' },
      { key: 'retro', title: 'Retrospectiva', description: 'As retrospectivas geram planos de ação reais que são cumpridos?' },
      { key: 'refinement', title: 'Backlog Refinement', description: 'As histórias chegam prontas para o planejamento?' },
      { key: 'po_presence', title: 'Presença do PO', description: 'O PO está disponível para tirar dúvidas e priorizar o trabalho?' },
    ]
  },
  {
    id: 'technical_excellence',
    name: 'Excelência Técnica',
    description: 'Focado em engenharia de software, dívida técnica e automação.',
    defaultScale: 'traffic_light',
    dimensions: [
      { key: 'tech_debt', title: 'Dívida Técnica', description: 'Conseguimos equilibrar novas features com a saúde do código?' },
      { key: 'ci_cd', title: 'CI/CD e Automação', description: 'Nossa esteira de deploy é confiável e automatizada?' },
      { key: 'testing', title: 'Cultura de Testes', description: 'Escrevemos testes que nos dão segurança para refatorar?' },
      { key: 'architecture', title: 'Arquitetura', description: 'O sistema é escalável e fácil de entender?' },
      { key: 'monitoring', title: 'Monitoramento', description: 'Sabemos quando algo quebra antes do cliente reclamar?' },
    ]
  },
  {
    id: 'team_morale',
    name: 'Clima e Moral (Team Pulse)',
    description: 'Mapeie o sentimento do time, nível de estresse e pertencimento.',
    defaultScale: 'emojis',
    dimensions: [
      { key: 'motivation', title: 'Motivação', description: 'Como você se sente em relação ao seu trabalho atual?' },
      { key: 'stress', title: 'Nível de Carga', description: 'Como está o seu volume de trabalho ultimamente?' },
      { key: 'inclusion', title: 'Segurança Psicológica', description: 'Você se sente seguro para dar opiniões divergentes?' },
      { key: 'growth', title: 'Aprendizado', description: 'Você sente que está evoluindo profissionalmente no time?' },
      { key: 'recognition', title: 'Reconhecimento', description: 'Você se sente valorizado pelo seu esforço?' },
    ]
  }
];
