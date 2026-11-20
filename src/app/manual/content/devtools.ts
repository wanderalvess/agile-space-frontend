import type { ManualBlock } from './types';

export const DEVTOOLS_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O DevTools é uma caixa de ferramentas para o dia a dia técnico: formatar JSON, decodificar um token, testar uma expressão regular, gerar dados de teste. A maioria roda dentro do seu navegador e não envia o que você cola para nenhum servidor.',
  },
  { kind: 'h2', text: 'Os cinco grupos' },
  {
    kind: 'li',
    text: '**Dados e formatos:** formate, converta e valide JSON, XML, YAML, SQL, planilhas e Markdown.',
  },
  {
    kind: 'li',
    text: '**Codificação e segurança:** Base64, URL, tokens JWT, certificados e um cofre de segredos.',
  },
  {
    kind: 'li',
    text: '**Texto e tempo:** expressões regulares, comparação de textos, datas e fusos, cron, identificadores e conversões.',
  },
  {
    kind: 'li',
    text: '**API e rede:** chamadas HTTP, trechos de código, cálculo de IP e consulta de CEP.',
  },
  {
    kind: 'li',
    text: '**Qualidade e testes:** massa de dados, Zephyr, cenários BDD, automação, valores extremos e JUnit. Veja [Central de qualidade](/manual/qualidade).',
  },
  { kind: 'h2', text: 'Como achar e usar uma ferramenta' },
  {
    kind: 'step',
    title: 'Busque ou filtre',
    text: 'Aperte `/` para ir direto à busca e digite o nome ou uma palavra, como “json”, “cep” ou “regex”. Os botões do topo filtram por grupo, e o filtro **Qualidade** junta as ferramentas de teste de vários grupos.',
  },
  {
    kind: 'step',
    title: 'Abra a ferramenta',
    text: 'Cada ferramenta abre na mesma página, com a entrada de um lado e o resultado do outro. O botão “Como usar” abre um guia curto com exemplos.',
  },
  {
    kind: 'step',
    title: 'Copie ou baixe o resultado',
    text: 'Cole ou digite a entrada, confira o resultado e use os botões para copiar ou baixar.',
  },
  {
    kind: 'step',
    title: 'Marque favoritas',
    text: 'Marque com a estrela as ferramentas que você mais usa. Elas aparecem na aba **Favoritas**, e as últimas que você abriu aparecem em **Recentes**. As duas listas ficam guardadas neste navegador, por usuário.',
  },
  { kind: 'h2', text: 'O que roda no navegador e o que usa um serviço externo' },
  {
    kind: 'p',
    text: 'Quase tudo roda no seu navegador: o que você cola não vai a lugar nenhum. As exceções avisam na própria tela.',
  },
  {
    kind: 'li',
    text: '**Consulta de CEP:** envia o CEP digitado ao serviço público ViaCEP.',
  },
  {
    kind: 'li',
    text: '**IP Analyzer:** só ao clicar em Localizar, envia o IP consultado ao serviço ipapi.co. O cálculo de CIDR e máscara fica no navegador.',
  },
  {
    kind: 'li',
    text: '**Cliente HTTP:** a requisição sai do navegador direto para o endereço que você digitar. Só alcança os endereços liberados pelo portal.',
  },
  {
    kind: 'li',
    text: '**Zephyr Explorer:** envia a consulta ao Zephyr pelo servidor do portal, com o seu token pessoal do Jira.',
  },
  {
    kind: 'li',
    text: '**Gerador JUnit:** o esqueleto é montado no navegador. Só se você colocar a sua chave do Gemini, o texto do cenário é enviado ao Google.',
  },
  {
    kind: 'warn',
    text: 'O Cofre de Segredos guarda os segredos cifrados neste navegador, protegidos por uma senha mestra que não é salva em lugar nenhum. Se você esquecer a senha, não há como recuperar o conteúdo.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'O JWT Inspector confere a assinatura?',
    a: 'Não. Ele só lê o cabeçalho, o conteúdo e a validade do token. A assinatura não é verificada.',
  },
  {
    kind: 'faq',
    q: 'Por que o Cliente HTTP não alcança a minha API?',
    a: 'Por segurança, o portal libera só alguns endereços para chamadas feitas pelo navegador. Se a sua API não estiver na lista, a requisição é bloqueada antes de sair.',
  },
  {
    kind: 'faq',
    q: 'Meus favoritos aparecem em outro computador?',
    a: 'Não. Favoritas e Recentes ficam guardadas no navegador em que você as marcou.',
  },
];
