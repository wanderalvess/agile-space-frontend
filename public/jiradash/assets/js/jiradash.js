// Bootstrap do dashboard. É o arquivo que o HTML carrega
// (<script type="module" src="./assets/js/jiradash.js">) e faz uma única coisa: registrar o
// listener que inicializa o app quando o documento termina de ser parseado.
//
// Não há IIFE nem 'use strict': ES Module já é estrito e tem escopo próprio, então nada
// vaza para o global. Toda a lógica vive em ./app.js e nos módulos que ele compõe.
//
// ⚠️ O listener não perde o evento: módulo é avaliado depois do parse do documento, mas
// ANTES de o DOMContentLoaded disparar — o evento espera a avaliação dos módulos deferidos.
// E `app.initialize()` é chamado NO objeto, preservando o receptor: os métodos dependem de
// `this`.
//
// ⚠️ AQUI SE REGISTRA UM listener, e o DOMContentLoaded natural do navegador dispara UMA vez —
// é dessa combinação que vem a inicialização única, não de nenhuma guarda dentro do app.
// `app.initialize()` e `bindEvents()` NÃO são idempotentes: uma segunda inicialização duplica
// os onze listeners delegados, em silêncio. Não acrescente um segundo registro, não chame
// `initialize()` à mão e não dispare um DOMContentLoaded sintético sem antes implementar uma
// guarda própria — em etapa separada. Ver app.js e AGENTS.md §9.
import { app } from './app.js';

window.addEventListener('DOMContentLoaded', () => app.initialize());
