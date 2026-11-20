/** Par de exemplo do botão "Usar exemplo": um pedido de venda do ERP e o que o destino espera. */
export const EXAMPLE_INPUT = {
  pedido: {
    numero: 458213,
    data: '2026-10-19',
    situacao: 'F',
    total: '298.80',
    vendedor: '0087',
    representante: '0087',
    condicaoPagamento: '30',
    cliente: {
      codigo: '001234',
      nome: 'Mercado Boa Compra Ltda',
      cnpj: '12.345.678/0001-90',
      cidade: 'Londrina',
      uf: 'PR',
    },
    itens: [
      { sku: 'A-1020', qtd: 12, preco: 14.9, un: 'CX', embalagem: 'CX' },
      { sku: 'B-3301', qtd: 6, preco: 20, un: 'UN', embalagem: 'UN' },
    ],
  },
};

export const EXAMPLE_OUTPUT = {
  idPedido: 458213,
  dataEmissao: '2026-10-19',
  status: 'FATURADO',
  valorTotal: 298.8,
  prazoPagamento: 30,
  vendedor: '0087',
  empresa: '01',
  origem: 'WINTHOR',
  cliente: {
    codigo: '001234',
    razaoSocial: 'Mercado Boa Compra Ltda',
    documento: '12345678000190',
    endereco: 'Londrina - PR',
  },
  itens: [
    { codigoProduto: 'A-1020', quantidade: 12, valorUnitario: 14.9, unidade: 'CX' },
    { codigoProduto: 'B-3301', quantidade: 6, valorUnitario: 20, unidade: 'UN' },
  ],
};

export const exampleInputText = (): string => JSON.stringify(EXAMPLE_INPUT, null, 2);
export const exampleOutputText = (): string => JSON.stringify(EXAMPLE_OUTPUT, null, 2);
