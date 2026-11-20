import type { ManualBlock } from './types';

export const QUALIDADE_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A Central de qualidade reúne num só lugar as ferramentas de teste do DevTools: massa de dados, Zephyr, cenários BDD, automação e conferência de APIs. Ela deixa de ser uma página separada e vira o filtro **Qualidade** do [DevTools](/manual/devtools).',
  },
  { kind: 'h2', text: 'Como usar' },
  {
    kind: 'step',
    title: 'Abra o DevTools',
    text: 'No menu de ferramentas, escolha **DevTools**. A lista de ferramentas já traz os filtros por grupo e, entre eles, o filtro Qualidade.',
  },
  {
    kind: 'step',
    title: 'Escolha o filtro Qualidade',
    text: 'O filtro mostra só as ferramentas de teste e qualidade, de vários grupos juntos. Dá para combinar com a busca, que acha a ferramenta pelo nome ou por uma palavra como “cpf”, “zephyr” ou “gherkin”.',
  },
  {
    kind: 'step',
    title: 'Abra a ferramenta',
    text: 'Cada ferramenta abre na mesma página do DevTools, com o botão “Como usar” ao lado. Para voltar, use o caminho no topo da página.',
  },
  { kind: 'h2', text: 'O que o filtro reúne' },
  {
    kind: 'li',
    text: '**Massa de Dados:** gera CPF, CNPJ e pessoas completas para testes, valida os números e exporta em CSV.',
  },
  {
    kind: 'li',
    text: '**Zephyr Explorer:** consulta ciclos e casos de teste do Zephyr com o seu token. É a única ferramenta desse grupo que fala com o servidor do portal.',
  },
  {
    kind: 'li',
    text: '**BDD e Bugs:** escreve cenários em Gherkin e relatos de bug padronizados.',
  },
  {
    kind: 'li',
    text: '**Gerador de Automação:** transforma o cenário no esqueleto de um teste em Cypress ou Playwright.',
  },
  {
    kind: 'li',
    text: '**Fuzz de Limites:** catálogo de valores extremos para testar campos de formulário.',
  },
  {
    kind: 'li',
    text: '**Gerador JUnit:** monta o esqueleto de um teste JUnit. O uso do Gemini é opcional e só acontece se você colocar a sua chave.',
  },
  {
    kind: 'li',
    text: '**Também no filtro:** formatar e validar JSON, XML, YAML e SQL, o Cliente HTTP, o Diff, o Regex Lab, o JWT Inspector e UUID e IDs. Eles servem ao trabalho de teste e continuam nos grupos deles.',
  },
  {
    kind: 'warn',
    text: 'Três ferramentas falam com a rede: o Zephyr Explorer usa o seu token do Jira pelo servidor do portal, o Gerador JUnit com Gemini envia o texto do cenário ao Google e o Cliente HTTP envia a requisição ao endereço que você digitar. As demais rodam só no navegador. Veja [DevTools](/manual/devtools).',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'A Central de qualidade sumiu?',
    a: 'Não. Ela virou o filtro Qualidade do DevTools. As ferramentas são as mesmas, em um único lugar.',
  },
  {
    kind: 'faq',
    q: 'Por que o Zephyr pede o domínio do Jira?',
    a: 'Ele consulta o Zephyr pelo Jira da sua squad. Informe o domínio e o token em Meu espaço, na aba Conta, em Conectividade.',
  },
];
