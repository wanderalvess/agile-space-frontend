// Algoritmos de geração de massa de dados brasileiros (CPF, CNPJ, cartão com Luhn, pessoa).
// Os dados são fictícios e servem apenas para testes.

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex';

export interface GeneratedCard {
  number: string;
  cvv: string;
  exp: string;
}

export interface GeneratedPerson {
  nome: string;
  email: string;
  cpf: string;
  rg: string;
  telefone: string;
  dataNascimento: string;
  cidade: string;
}

export function randomDigits(num: number): string {
  let res = '';
  for (let i = 0; i < num; i++) res += Math.floor(Math.random() * 10).toString();
  return res;
}

export function generateCPF(formatted: boolean = true): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  let d1 = n.reduce((acc, curr, index) => acc + curr * (10 - index), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  let d2 = [...n, d1].reduce((acc, curr, index) => acc + curr * (11 - index), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  const raw = [...n, d1, d2].join('');
  if (!formatted) return raw;
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}

export function generateCNPJ(formatted: boolean = true): string {
  const n = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  n.push(0, 0, 0, 1); // Filial 0001 por padrão

  const weight1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d1 = n.reduce((acc, curr, index) => acc + curr * weight1[index], 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  const weight2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d2 = [...n, d1].reduce((acc, curr, index) => acc + curr * weight2[index], 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  const raw = [...n, d1, d2].join('');
  if (!formatted) return raw;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

export function generateCreditCard(brand: CardBrand = 'visa'): GeneratedCard {
  let prefix = '4';
  let length = 16;

  if (brand === 'mastercard') {
    prefix = ['51', '52', '53', '54', '55'][Math.floor(Math.random() * 5)];
  } else if (brand === 'amex') {
    prefix = ['34', '37'][Math.floor(Math.random() * 2)];
    length = 15;
  } else if (brand === 'elo') {
    prefix = '636368';
  }

  const numArr = prefix.split('').map(Number);
  while (numArr.length < length - 1) numArr.push(Math.floor(Math.random() * 10));

  // Dígito verificador (Luhn)
  let sum = 0;
  for (let i = 0; i < numArr.length; i++) {
    let val = numArr[numArr.length - 1 - i];
    if (i % 2 === 0) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
  }
  numArr.push((10 - (sum % 10)) % 10);

  const cvv = brand === 'amex' ? randomDigits(4) : randomDigits(3);
  const currentYear = new Date().getFullYear();
  const expMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const expYear = String(currentYear + Math.floor(Math.random() * 5) + 1).slice(-2);

  return { number: numArr.join('').replace(/(.{4})/g, '$1 ').trim(), cvv, exp: `${expMonth}/${expYear}` };
}

const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'Lucas', 'Mariana', 'Mateus', 'Patricia', 'Rafael', 'Sofia', 'Thiago'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho'];
const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Campinas', 'Recife', 'Florianópolis'];

export function generatePerson(formatted: boolean = true): GeneratedPerson {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const birthYear = Math.floor(Math.random() * (2002 - 1970 + 1)) + 1970;
  const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

  return {
    nome: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}@teste.com.br`,
    cpf: generateCPF(formatted),
    rg: `${randomDigits(2)}.${randomDigits(3)}.${randomDigits(3)}-${randomDigits(1)}`,
    telefone: `(11) 9${randomDigits(4)}-${randomDigits(4)}`,
    dataNascimento: `${birthDay}/${birthMonth}/${birthYear}`,
    cidade: CITIES[Math.floor(Math.random() * CITIES.length)],
  };
}
