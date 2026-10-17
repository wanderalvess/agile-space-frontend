import { RETRO_TEMPLATES, type RetroColumnDef, type RetroTemplateKey } from './types';

/** Formatos prontos (todos menos o personalizado): cada um tem cenário e identidade por coluna. */
export type RetroThemedFormat = Exclude<RetroTemplateKey, 'custom'>;

/** Cenário de fundo da sala; hoje há um por formato pronto (o personalizado fica sem cenário). */
export type RetroSceneKey = RetroThemedFormat;

/** Nome do ícone de linha 1,5 de cada coluna: o mapa para o desenho fica em components/retro/column-icons.tsx. */
export type RetroColumnIconName =
  | 'alert'
  | 'anchor'
  | 'ban'
  | 'book'
  | 'bricks'
  | 'bubble'
  | 'bud'
  | 'checkcircle'
  | 'cloudbolt'
  | 'cloudrain'
  | 'coffee'
  | 'compass'
  | 'dashed'
  | 'ff'
  | 'flag'
  | 'flame'
  | 'flask'
  | 'flower'
  | 'gauge'
  | 'heart'
  | 'hourglass'
  | 'lifebuoy'
  | 'link'
  | 'listchecks'
  | 'minuscircle'
  | 'mountain'
  | 'parachute'
  | 'planks'
  | 'play'
  | 'plus'
  | 'pluscircle'
  | 'repeat'
  | 'scissors'
  | 'search'
  | 'shield'
  | 'shieldcheck'
  | 'smile'
  | 'spike'
  | 'sprout'
  | 'star'
  | 'stop'
  | 'straw'
  | 'sun'
  | 'target'
  | 'trend'
  | 'triangle'
  | 'undo'
  | 'weight'
  | 'wind'
  | 'wrench';

export interface RetroColumnIdentity {
  icon: RetroColumnIconName;
  /** Pergunta-guia sob o título da coluna. */
  guia: string;
  /** Estado vazio na voz da metáfora. */
  vazio: { titulo: string; dica: string };
  /** Começo de frase do campo de novo cartão. */
  placeholder: string;
}

export interface RetroPhaseMinutes {
  /** Quebra-gelo de abertura. */
  ice: number;
  write: number;
  reveal: number;
  vote: number;
  act: number;
}

export interface RetroFormatTheme {
  cenario: RetroSceneKey;
  /** Ícone que representa o formato no lobby e no seletor (o mini-ícone do chip). */
  emblema: RetroColumnIconName;
  /** Descrição curta do cenário (dica da miniatura). */
  tag: string;
  /** Tem elementos que se movem no modo Completo (nuvens, barco, estrelas). */
  animado: boolean;
  quebraGelo: string;
  temposPorFase: RetroPhaseMinutes;
  /** Por id de coluna do formato (os mesmos de `RETRO_TEMPLATES`). */
  colunas: Record<string, RetroColumnIdentity>;
}

/**
 * Identidade visual de cada formato pronto. Os ids de coluna batem com `RETRO_TEMPLATES` (um teste confere).
 * Formato personalizado, quadro antigo e formato salvo sem chave conhecida não entram aqui: ficam com o cenário neutro.
 */
export const RETRO_FORMAT_THEMES: Record<RetroThemedFormat, RetroFormatTheme> = {
  classic: {
    cenario: 'classic',
    emblema: 'listchecks',
    tag: 'Mural de post-its e a mesa da squad',
    animado: false,
    quebraGelo: 'Uma palavra: cada pessoa resume a sprint em uma palavra e diz por quê.',
    temposPorFase: { ice: 3, write: 8, reveal: 5, vote: 4, act: 10 },
    colunas: {
      wentWell: { icon: 'checkcircle', guia: 'O que deu certo e vale repetir?', vazio: { titulo: 'Mural sem post-its', dica: 'Cole aqui o que deu certo na sprint.' }, placeholder: 'O que funcionou bem nesta sprint…' },
      toImprove: { icon: 'wrench', guia: 'O que atrapalhou ou podia ser melhor?', vazio: { titulo: 'Nada colado ainda', dica: 'O que travou o ritmo da squad?' }, placeholder: 'O que travou ou podia ter sido melhor…' },
      actionItems: { icon: 'listchecks', guia: 'O que vamos fazer, quem leva e até quando?', vazio: { titulo: 'Nenhuma ação combinada', dica: 'Transforme os mais votados em ações com dono.' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  start_stop_continue: {
    cenario: 'start_stop_continue',
    emblema: 'play',
    tag: 'Estrada com semáforo: começar, parar, seguir',
    animado: false,
    quebraGelo: 'Semáforo da semana: cada pessoa mostra, com a mão, verde, amarelo ou vermelho.',
    temposPorFase: { ice: 2, write: 7, reveal: 5, vote: 3, act: 8 },
    colunas: {
      start: { icon: 'play', guia: 'O que ainda não fazemos e deveríamos começar?', vazio: { titulo: 'Sinal ainda fechado', dica: 'Que prática nova vale começar já?' }, placeholder: 'Começar a…' },
      stop: { icon: 'stop', guia: 'O que fazemos e só atrapalha?', vazio: { titulo: 'Nada para frear', dica: 'O que consome tempo e não entrega valor?' }, placeholder: 'Parar de…' },
      continue: { icon: 'repeat', guia: 'O que está funcionando e deve seguir?', vazio: { titulo: 'Pista livre', dica: 'O que vale manter exatamente como está?' }, placeholder: 'Continuar a…' },
    },
  },
  plus_delta: {
    cenario: 'plus_delta',
    emblema: 'pluscircle',
    tag: 'Balança com um prato de cada lado',
    animado: false,
    quebraGelo: 'De 0 a 5: quão boa foi a sprint? Cada pessoa dá a nota e um só motivo.',
    temposPorFase: { ice: 2, write: 4, reveal: 3, vote: 2, act: 6 },
    colunas: {
      plus: { icon: 'plus', guia: 'O que repetiríamos sem pensar?', vazio: { titulo: 'Prato sem peso', dica: 'O que pesou a favor e merece repetição?' }, placeholder: 'Mais disso: …' },
      delta: { icon: 'triangle', guia: 'O que mudaríamos na próxima sprint?', vazio: { titulo: 'Outro prato vazio', dica: 'Uma mudança pequena já vale.' }, placeholder: 'Mudar isto: …' },
      actionItems: { icon: 'listchecks', guia: 'Qual mudança vira ação agora?', vazio: { titulo: 'Balança parada', dica: 'Escolha o delta que mais pesa e dê dono a ele.' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  starfish: {
    cenario: 'starfish',
    emblema: 'star',
    tag: 'Fundo do mar: cinco braços, cinco colunas',
    animado: true,
    quebraGelo: 'Mergulho rápido: cada pessoa conta, em 10 segundos, o que viu de mais interessante na sprint.',
    temposPorFase: { ice: 3, write: 8, reveal: 6, vote: 4, act: 10 },
    colunas: {
      keep: { icon: 'shield', guia: 'O que está bom e precisa continuar?', vazio: { titulo: 'Braço sem corais', dica: 'O que está firme e deve ficar como está?' }, placeholder: 'Manter…' },
      less: { icon: 'minuscircle', guia: 'O que fazemos demais?', vazio: { titulo: 'Água calma', dica: 'Onde estamos exagerando?' }, placeholder: 'Menos…' },
      more: { icon: 'pluscircle', guia: 'O que vale fazer com mais frequência?', vazio: { titulo: 'Nada boiando', dica: 'O que ajudou e poderia acontecer mais vezes?' }, placeholder: 'Mais…' },
      start: { icon: 'play', guia: 'O que ainda não existe e deveria?', vazio: { titulo: 'Sem correnteza nova', dica: 'Que ideia merece ser testada?' }, placeholder: 'Começar…' },
      stop: { icon: 'stop', guia: 'O que deixaríamos de fazer amanhã?', vazio: { titulo: 'Nenhuma âncora a soltar', dica: 'O que só nos deixa mais lentos?' }, placeholder: 'Parar…' },
    },
  },
  four_ls: {
    cenario: 'four_ls',
    emblema: 'book',
    tag: 'Estante, poltrona e abajur: hora de ler a sprint',
    animado: false,
    quebraGelo: 'Livro da sprint: se esta sprint fosse um livro, qual seria o título?',
    temposPorFase: { ice: 3, write: 8, reveal: 6, vote: 4, act: 10 },
    colunas: {
      liked: { icon: 'heart', guia: 'O que você curtiu nesta sprint?', vazio: { titulo: 'Prateleira vazia', dica: 'O que fez você gostar de trabalhar nesta sprint?' }, placeholder: 'Curti…' },
      learned: { icon: 'book', guia: 'O que você aprendeu?', vazio: { titulo: 'Nenhuma lição guardada', dica: 'Que aprendizado vale dividir com a squad?' }, placeholder: 'Aprendi que…' },
      lacked: { icon: 'dashed', guia: 'O que fez falta?', vazio: { titulo: 'Nada faltando por aqui', dica: 'Que informação, apoio ou ferramenta fez falta?' }, placeholder: 'Faltou…' },
      longed_for: { icon: 'star', guia: 'O que você gostaria de ter tido?', vazio: { titulo: 'Nenhum desejo na estante', dica: 'Qual seria o cenário ideal na próxima sprint?' }, placeholder: 'Desejei…' },
      actionItems: { icon: 'listchecks', guia: 'Que passo concreto sai desta conversa?', vazio: { titulo: 'Nenhuma anotação final', dica: 'Escolha o que sai da estante e vira prática.' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  daki: {
    cenario: 'daki',
    emblema: 'sprout',
    tag: 'Jardim: podar, plantar, manter e regar',
    animado: false,
    quebraGelo: 'Jardinagem: cite uma prática que nasceu bem e uma que já deveria ter sido podada.',
    temposPorFase: { ice: 3, write: 8, reveal: 6, vote: 4, act: 10 },
    colunas: {
      drop: { icon: 'scissors', guia: 'Que prática podemos podar?', vazio: { titulo: 'Nada para podar', dica: 'O que já não dá fruto e ocupa espaço?' }, placeholder: 'Remover…' },
      add: { icon: 'sprout', guia: 'Que prática vale plantar?', vazio: { titulo: 'Canteiro livre', dica: 'Que prática nova a squad poderia plantar?' }, placeholder: 'Adicionar…' },
      keep: { icon: 'shield', guia: 'Que prática está florescendo?', vazio: { titulo: 'Nenhuma planta firme ainda', dica: 'O que dá resultado e precisa de cuidado?' }, placeholder: 'Manter…' },
      improve: { icon: 'trend', guia: 'Que prática pede mais cuidado?', vazio: { titulo: 'Nada para regar', dica: 'O que funciona, mas poderia render mais?' }, placeholder: 'Melhorar…' },
      actionItems: { icon: 'listchecks', guia: 'O que podamos, plantamos ou regamos primeiro?', vazio: { titulo: 'Nenhuma tarefa no jardim', dica: 'Transforme as ideias mais votadas em ações.' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  mad_sad_glad: {
    cenario: 'mad_sad_glad',
    emblema: 'cloudrain',
    tag: 'O tempo da squad: sol, chuva e tempestade',
    animado: true,
    quebraGelo: 'Previsão do tempo: cada pessoa diz como está o seu tempo hoje (sol, nublado ou chuva).',
    temposPorFase: { ice: 3, write: 6, reveal: 6, vote: 3, act: 8 },
    colunas: {
      glad: { icon: 'smile', guia: 'O que deixou você feliz?', vazio: { titulo: 'Sem sol por aqui', dica: 'O que alegrou você nesta sprint?' }, placeholder: 'Fiquei feliz com…' },
      sad: { icon: 'cloudrain', guia: 'O que deixou você triste ou desanimado?', vazio: { titulo: 'Céu limpo', dica: 'O que pesou ou desanimou?' }, placeholder: 'Fiquei triste com…' },
      mad: { icon: 'flame', guia: 'O que deixou você irritado?', vazio: { titulo: 'Sem tempestade', dica: 'O que tirou você do sério? Conte sem culpar ninguém.' }, placeholder: 'Fiquei irritado com…' },
    },
  },
  rose_thorn_bud: {
    cenario: 'rose_thorn_bud',
    emblema: 'flower',
    tag: 'Roseira ao entardecer: flor, espinho e broto',
    animado: false,
    quebraGelo: 'Flor do dia: cada pessoa escolhe uma flor para descrever a sprint e diz por quê.',
    temposPorFase: { ice: 3, write: 6, reveal: 5, vote: 3, act: 8 },
    colunas: {
      rose: { icon: 'flower', guia: 'O que floresceu nesta sprint?', vazio: { titulo: 'Nenhuma rosa aberta', dica: 'O que deu certo e merece ser celebrado?' }, placeholder: 'Floresceu…' },
      thorn: { icon: 'spike', guia: 'O que machucou ou incomodou?', vazio: { titulo: 'Nenhum espinho', dica: 'Descreva o fato, não a pessoa.' }, placeholder: 'Machucou…' },
      bud: { icon: 'bud', guia: 'O que pode nascer daqui?', vazio: { titulo: 'Nenhum broto', dica: 'Que oportunidade começa a aparecer?' }, placeholder: 'Pode nascer…' },
      actionItems: { icon: 'listchecks', guia: 'O que vamos regar nesta semana?', vazio: { titulo: 'Nada para regar', dica: 'Que ação ajuda um broto a abrir?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  kudos: {
    cenario: 'kudos',
    emblema: 'heart',
    tag: 'Festa de agradecimento: bandeirolas, balões e troféu',
    animado: true,
    quebraGelo: 'Roda de gratidão: cada pessoa agradece alguém da squad em uma frase.',
    temposPorFase: { ice: 3, write: 6, reveal: 8, vote: 2, act: 6 },
    colunas: {
      thanks: { icon: 'heart', guia: 'Quem ou o que merece um agradecimento?', vazio: { titulo: 'Ninguém na festa ainda', dica: 'Quem ajudou você nesta sprint?' }, placeholder: 'Obrigado, [nome], por…' },
      learned: { icon: 'book', guia: 'O que você aprendeu com alguém?', vazio: { titulo: 'Nenhum aprendizado ainda', dica: 'O que alguém ensinou, mesmo sem querer?' }, placeholder: 'Aprendi com [nome]…' },
      help: { icon: 'lifebuoy', guia: 'Com o que você precisa de uma mão?', vazio: { titulo: 'Nenhum pedido', dica: 'Pedir ajuda também é entregar.' }, placeholder: 'Preciso de ajuda com…' },
      actionItems: { icon: 'listchecks', guia: 'Como mantemos esse clima vivo?', vazio: { titulo: 'Nenhuma ação', dica: 'Que gesto pequeno mantém a gratidão rolando?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  sailboat: {
    cenario: 'sailboat',
    emblema: 'anchor',
    tag: 'Mar aberto ao pôr do sol, com pedras no horizonte',
    animado: true,
    quebraGelo: 'Rumo ao horizonte: em uma frase, para onde a squad está navegando?',
    temposPorFase: { ice: 3, write: 8, reveal: 6, vote: 4, act: 10 },
    colunas: {
      wind: { icon: 'wind', guia: 'O que nos empurrou para a frente?', vazio: { titulo: 'Mar sem vento', dica: 'O que nos fez ganhar velocidade?' }, placeholder: 'O vento a favor foi…' },
      sun: { icon: 'sun', guia: 'O que alegrou a tripulação?', vazio: { titulo: 'Céu fechado', dica: 'O que fez a tripulação sorrir?' }, placeholder: 'O que aqueceu a tripulação…' },
      anchor: { icon: 'anchor', guia: 'O que nos segurou no lugar?', vazio: { titulo: 'Âncora recolhida', dica: 'O que nos deixou parados ou lentos?' }, placeholder: 'A âncora foi…' },
      rocks: { icon: 'mountain', guia: 'Que riscos aparecem no horizonte?', vazio: { titulo: 'Mar limpo à frente', dica: 'Que riscos você enxerga antes de chegarmos neles?' }, placeholder: 'À frente vejo…' },
      actionItems: { icon: 'listchecks', guia: 'Que manobra corrige a rota?', vazio: { titulo: 'Nenhuma manobra traçada', dica: 'Quem assume o leme de cada ajuste?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  hot_air_balloon: {
    cenario: 'hot_air_balloon',
    emblema: 'flame',
    tag: 'Céu com tempestade à esquerda e destino à direita',
    animado: true,
    quebraGelo: 'Altitude: de 0 a 10, a que altura está o balão da squad hoje?',
    temposPorFase: { ice: 3, write: 8, reveal: 6, vote: 4, act: 10 },
    colunas: {
      hotAir: { icon: 'flame', guia: 'O que fez o balão subir?', vazio: { titulo: 'Balão sem fogo', dica: 'O que alimentou o ar quente da squad?' }, placeholder: 'Nos fez subir…' },
      ballast: { icon: 'weight', guia: 'O que nos segurou no chão?', vazio: { titulo: 'Nenhum saco de areia', dica: 'O que pesou e atrasou a subida?' }, placeholder: 'Nos segurou…' },
      storm: { icon: 'cloudbolt', guia: 'Que tempestades vemos adiante?', vazio: { titulo: 'Céu aberto', dica: 'Que riscos estão se formando à frente?' }, placeholder: 'Vejo tempestade em…' },
      sky: { icon: 'compass', guia: 'Aonde queremos chegar?', vazio: { titulo: 'Destino em branco', dica: 'Descreva o destino que queremos alcançar.' }, placeholder: 'Queremos chegar a…' },
      actionItems: { icon: 'listchecks', guia: 'O que fazemos para subir mais?', vazio: { titulo: 'Nenhuma ação a bordo', dica: 'Quem solta qual saco de areia?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  three_little_pigs: {
    cenario: 'three_little_pigs',
    emblema: 'bricks',
    tag: 'Três casinhas: palha, madeira e tijolo',
    animado: false,
    quebraGelo: 'Casinha: a squad é uma casa. De que material ela se sente feita hoje?',
    temposPorFase: { ice: 3, write: 6, reveal: 5, vote: 3, act: 8 },
    colunas: {
      straw: { icon: 'straw', guia: 'O que está frágil e cai com um sopro?', vazio: { titulo: 'Nenhuma palha', dica: 'Que processo cai ao primeiro vento?' }, placeholder: 'É de palha: …' },
      wood: { icon: 'planks', guia: 'O que aguenta, mas pode ficar mais forte?', vazio: { titulo: 'Nenhuma tábua', dica: 'O que resiste, mas já mostra rachaduras?' }, placeholder: 'É de madeira: …' },
      brick: { icon: 'bricks', guia: 'O que está sólido e deve ser protegido?', vazio: { titulo: 'Nenhum tijolo ainda', dica: 'Que prática nem o lobo derruba?' }, placeholder: 'É de tijolo: …' },
      actionItems: { icon: 'listchecks', guia: 'O que reforçamos primeiro?', vazio: { titulo: 'Nenhuma obra planejada', dica: 'Por onde começamos a reforçar?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  speed_car: {
    cenario: 'speed_car',
    emblema: 'gauge',
    tag: 'Estrada ao pôr do sol: motor e paraquedas',
    animado: true,
    quebraGelo: 'Velocímetro: cada pessoa diz a que velocidade a squad andou, de 0 a 200.',
    temposPorFase: { ice: 2, write: 6, reveal: 4, vote: 3, act: 8 },
    colunas: {
      engine: { icon: 'gauge', guia: 'O que nos fez acelerar?', vazio: { titulo: 'Motor frio', dica: 'O que deu velocidade à squad?' }, placeholder: 'Acelerou quando…' },
      parachute: { icon: 'parachute', guia: 'O que nos freou?', vazio: { titulo: 'Paraquedas fechado', dica: 'O que puxou o freio na hora errada?' }, placeholder: 'Freou quando…' },
      actionItems: { icon: 'listchecks', guia: 'O que soltamos e o que acionamos?', vazio: { titulo: 'Nada no painel', dica: 'Que ajuste solta o paraquedas ou aperta o acelerador?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  lean_coffee: {
    cenario: 'lean_coffee',
    emblema: 'coffee',
    tag: 'Cafeteria com três xícaras: cheia, pela metade e vazia',
    animado: true,
    quebraGelo: 'Café: cada pessoa serve um café (ou chá) imaginário e diz uma palavra para o dia.',
    temposPorFase: { ice: 2, write: 5, reveal: 3, vote: 3, act: 25 },
    colunas: {
      toDiscuss: { icon: 'bubble', guia: 'Que assunto vale a conversa?', vazio: { titulo: 'Mesa sem pauta', dica: 'Que tema você levaria para o café?' }, placeholder: 'Quero discutir…' },
      discussing: { icon: 'coffee', guia: 'Qual tema estamos discutindo agora?', vazio: { titulo: 'Nenhum tema na xícara', dica: 'Arraste para cá o tema mais votado.' }, placeholder: 'Anote o que foi dito…' },
      discussed: { icon: 'checkcircle', guia: 'O que ficou decidido?', vazio: { titulo: 'Nada discutido', dica: 'Os temas concluídos descansam aqui.' }, placeholder: 'Decidimos…' },
      actionItems: { icon: 'listchecks', guia: 'O que fazemos com o que foi decidido?', vazio: { titulo: 'Nenhuma ação do café', dica: 'Cada tema discutido pode virar uma ação.' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  sprint_goal: {
    cenario: 'sprint_goal',
    emblema: 'flag',
    tag: 'Montanha com trilha, marcos e o próximo pico',
    animado: false,
    quebraGelo: 'Foto do pico: mostre com os dedos (0 a 5) quão perto da meta a squad chegou.',
    temposPorFase: { ice: 3, write: 6, reveal: 5, vote: 3, act: 10 },
    colunas: {
      goal: { icon: 'target', guia: 'Chegamos ao pico? Por quê?', vazio: { titulo: 'Pico à vista', dica: 'Atingimos a meta? Conte o que decidiu o resultado.' }, placeholder: 'Sobre a meta: …' },
      blockers: { icon: 'ban', guia: 'O que se pôs no caminho?', vazio: { titulo: 'Trilha livre', dica: 'Que pedras apareceram no caminho da meta?' }, placeholder: 'Atrapalhou…' },
      helped: { icon: 'link', guia: 'O que nos ajudou a avançar?', vazio: { titulo: 'Nenhuma corda ainda', dica: 'O que facilitou a subida?' }, placeholder: 'Ajudou…' },
      nextGoal: { icon: 'flag', guia: 'Qual é o próximo pico?', vazio: { titulo: 'Próximo pico na névoa', dica: 'O que a próxima meta precisa ter para ser alcançável?' }, placeholder: 'Na próxima meta…' },
      actionItems: { icon: 'listchecks', guia: 'O que muda na trilha da próxima sprint?', vazio: { titulo: 'Trilha sem marcos', dica: 'Que ajuste marca o caminho até o próximo pico?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  workflow: {
    cenario: 'workflow',
    emblema: 'ff',
    tag: 'Rio com represa e um retorno: fluiu, parou, voltou',
    animado: true,
    quebraGelo: 'Mapa do rio: cada pessoa aponta um ponto do fluxo em que o trabalho esperou.',
    temposPorFase: { ice: 3, write: 8, reveal: 6, vote: 4, act: 10 },
    colunas: {
      fast: { icon: 'ff', guia: 'Onde o trabalho correu sem obstáculo?', vazio: { titulo: 'Rio parado', dica: 'Em que etapa o trabalho andou sozinho?' }, placeholder: 'Fluiu rápido…' },
      stuck: { icon: 'hourglass', guia: 'Onde ele ficou esperando ou bloqueado?', vazio: { titulo: 'Nenhuma represa', dica: 'Onde as tarefas esperaram por alguém ou algo?' }, placeholder: 'Ficou parado…' },
      rework: { icon: 'undo', guia: 'O que voltou para ser refeito?', vazio: { titulo: 'Nada voltou', dica: 'O que precisou ser refeito, e por quê?' }, placeholder: 'Voltou porque…' },
      tryNext: { icon: 'flask', guia: 'Que experimento testamos na próxima sprint?', vazio: { titulo: 'Nenhum experimento', dica: 'Qual mudança no fluxo vale um teste?' }, placeholder: 'Testar…' },
      actionItems: { icon: 'listchecks', guia: 'Que ajuste destrava o fluxo?', vazio: { titulo: 'Nenhum ajuste', dica: 'Quem cuida de cada ajuste e até quando?' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
  incident: {
    cenario: 'incident',
    emblema: 'shieldcheck',
    tag: 'Farol ao amanhecer: calma depois da tempestade',
    animado: true,
    quebraGelo: 'Respiro: cada pessoa diz como está depois do incidente, sem falar da causa ainda.',
    temposPorFase: { ice: 3, write: 10, reveal: 8, vote: 3, act: 12 },
    colunas: {
      happened: { icon: 'alert', guia: 'O que aconteceu, em ordem e sem julgar?', vazio: { titulo: 'Linha do tempo vazia', dica: 'Conte os fatos na ordem em que aconteceram.' }, placeholder: 'Às… o que vimos foi…' },
      factors: { icon: 'search', guia: 'Que fatores levaram a isso? (sistema, não pessoas)', vazio: { titulo: 'Nenhum fator listado', dica: 'Foque em processos e sistemas, não em culpados.' }, placeholder: 'Contribuiu…' },
      wentWell: { icon: 'shieldcheck', guia: 'O que ajudou na resposta?', vazio: { titulo: 'Nada anotado', dica: 'O que nos fez resolver mais rápido ou sofrer menos?' }, placeholder: 'Ajudou…' },
      prevent: { icon: 'shield', guia: 'Como evitamos que se repita?', vazio: { titulo: 'Nenhuma barreira', dica: 'Que mudanças impedem o mesmo problema?' }, placeholder: 'Para evitar…' },
      actionItems: { icon: 'listchecks', guia: 'Quais ações assumimos e quem leva?', vazio: { titulo: 'Nenhuma ação', dica: 'Cada barreira precisa de dono e prazo.' }, placeholder: 'Ação com responsável e prazo…' },
    },
  },
};

/** Identidade do formato pelo `templateKey` do quadro; `null` para personalizado, quadro antigo ou chave desconhecida (cenário neutro). */
export function retroFormatTheme(key?: string | null): RetroFormatTheme | null {
  if (!key || !Object.prototype.hasOwnProperty.call(RETRO_FORMAT_THEMES, key)) return null;
  return RETRO_FORMAT_THEMES[key as RetroThemedFormat];
}

/** Cenário do quadro, ou `null` (neutro: só o fundo do tema). */
export function retroSceneKey(key?: string | null): RetroSceneKey | null {
  return retroFormatTheme(key)?.cenario ?? null;
}

/** A facilitação mudou o nome da coluna em relação ao do formato? Então pergunta-guia e texto do vazio perdem o sentido. */
export function isColumnRenamed(key: string | null | undefined, column: Pick<RetroColumnDef, 'id' | 'title'>): boolean {
  if (!key || !Object.prototype.hasOwnProperty.call(RETRO_TEMPLATES, key)) return false;
  const original = RETRO_TEMPLATES[key as RetroThemedFormat].find((c) => c.id === column.id);
  return !!original && original.title.trim() !== column.title.trim();
}

export interface ResolvedColumnIdentity {
  identity: RetroColumnIdentity;
  /** Coluna renomeada: o ícone fica; pergunta-guia, estado vazio e placeholder voltam ao genérico do tipo. */
  renamed: boolean;
}

/** Identidade de uma coluna do quadro, ou `null` quando o formato não tem (personalizado, id desconhecido). */
export function resolveColumnIdentity(key: string | null | undefined, column: Pick<RetroColumnDef, 'id' | 'title'>): ResolvedColumnIdentity | null {
  const identity = retroFormatTheme(key)?.colunas[column.id];
  if (!identity) return null;
  return { identity, renamed: isColumnRenamed(key, column) };
}

export type RetroSuggestedPhase = 'write' | 'reveal' | 'vote' | 'act';

/** Minutos sugeridos para uma fase do formato (sem formato, `null`). */
export function suggestedMinutes(key: string | null | undefined, phase: RetroSuggestedPhase): number | null {
  return retroFormatTheme(key)?.temposPorFase[phase] ?? null;
}
