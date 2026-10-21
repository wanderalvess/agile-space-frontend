import type { ManualBlock } from './types';

export const JOLT_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Jolt transforma um JSON em outro a partir de uma especificação, a “spec”. Você pode escrever a spec à mão na Sandbox ou dar um exemplo de entrada e de saída ao Gerador de spec e deixar o portal montar a regra de cada campo.',
  },
  { kind: 'h2', text: 'Sandbox' },
  {
    kind: 'step',
    title: 'Cole a entrada e a spec',
    text: 'Dois editores lado a lado, um para o JSON de entrada e outro para a spec. O resultado aparece ao lado e os erros de sintaxe ficam destacados. Os modelos de operação (shift, modify, cardinality, default e remove) preenchem a spec para você.',
  },
  {
    kind: 'step',
    title: 'Escolha o motor',
    text: '**JavaScript** roda no navegador. **Java** roda no motor oficial do Jolt, no servidor do portal. **Comparar** roda os dois e lista as diferenças de conteúdo; só a ordem das chaves não conta como diferença.',
  },
  {
    kind: 'step',
    title: 'Carregue um layout',
    text: 'A barra do GitHub escolhe Integração, Rota e Versão no repositório de layouts e carrega o arquivo na hora. Os layouts que você salva ficam neste navegador, por usuário, e não vão ao servidor.',
  },
  {
    kind: 'step',
    title: 'Faça a manutenção de um layout existente',
    text: 'Com um layout completo carregado, o botão **Manutenção** lista os campos da entrada que a spec ainda não usa, insere o novo na shift com o padrão dos vizinhos e permite trocar ou remover destinos. Modify, default e condicionais não são tocados. **Layout completo** devolve o arquivo inteiro com a spec atualizada.',
  },
  { kind: 'h2', text: 'Gerador de spec' },
  {
    kind: 'step',
    title: 'Dê o exemplo',
    text: 'Cole a resposta da API de origem e a saída que a API de destino espera. Vindo da Sandbox, a entrada já chega preenchida.',
  },
  {
    kind: 'step',
    title: 'Confirme as regras',
    text: 'O gerador mostra uma linha por campo da saída: de onde vem e qual é a regra (copiar, como texto, só dígitos, concatenar, de-para, fixo ou variável da rota). Em **A confirmar** ficam os pontos que o exemplo não prova sozinho, como dois campos de entrada com o mesmo valor.',
  },
  {
    kind: 'step',
    title: 'Confira a spec',
    text: 'O portal roda a spec no motor Java e compara com a saída esperada, campo a campo. Se bater, você copia a spec ou monta o registro completo da rota. **Abrir na Sandbox** leva a spec e a entrada para refinar.',
  },
  {
    kind: 'step',
    title: 'Parta de um registro existente',
    text: 'Com **Carregar registro**, o gerador reaproveita o arquivo da rota e troca só a spec.',
  },
  { kind: 'h2', text: 'Os operadores' },
  {
    kind: 'li',
    text: '`shift`: mapeia a estrutura chave a chave, com curingas (`*`) e ramificações condicionais.',
  },
  { kind: 'li', text: '`default`: insere valores padrão onde o campo está ausente.' },
  {
    kind: 'li',
    text: '`cardinality`: normaliza um atributo entre objeto e lista, para estabilizar APIs externas.',
  },
  { kind: 'li', text: '`remove`: tira campos que não devem sair.' },
  {
    kind: 'li',
    text: '**Atalhos de caminho:** `&1` referencia o nome do nó um nível acima, e `$` extrai o valor da própria chave de entrada.',
  },
  {
    kind: 'warn',
    text: 'O GitHub é consultado sem login, e o limite é de cerca de 60 consultas por hora por rede. A tela avisa quando o limite acaba.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'O que vale mais: o motor JavaScript ou o Java?',
    a: 'O Java é o motor oficial do Jolt. Use o JavaScript para testar rápido e o modo Comparar para ver se os dois concordam.',
  },
  {
    kind: 'faq',
    q: 'Meus layouts salvos aparecem em outro computador?',
    a: 'Não. Eles ficam guardados neste navegador. Para levar um layout, baixe o arquivo.',
  },
];
