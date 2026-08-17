import type { HealthCheckDimension } from './types';

export const DEFAULT_HEALTH_CHECK_DIMENSIONS: HealthCheckDimension[] = [
  { key: 'support', title: 'Apoio e Suporte', description: 'Recebemos a ajuda necessária de fora do time?' },
  { key: 'teamwork', title: 'Trabalho em Equipe', description: 'Colaboramos bem e nos ajudamos internamente?' },
  { key: 'code_quality', title: 'Qualidade do Código', description: 'Temos orgulho da qualidade do que construímos?' },
  { key: 'value', title: 'Entrega de Valor', description: 'Estamos entregando valor real para nossos clientes?' },
  { key: 'speed', title: 'Velocidade', description: 'Conseguimos entregar rápido sem impedimentos?' },
  { key: 'fun', title: 'Diversão/Moral', description: 'Nós nos divertimos trabalhando juntos e estamos motivados?' },
  { key: 'processes', title: 'Processos', description: 'Nossos processos nos ajudam ou nos atrapalham?' },
  { key: 'mission', title: 'Missão Clara', description: 'Entendemos e acreditamos no nosso propósito?' },
];
