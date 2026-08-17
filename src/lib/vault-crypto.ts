/**
 * Vault Crypto - Utiliza a Web Crypto API nativa para criptografia E2EE.
 * Algoritmo: AES-GCM (256 bits)
 */

const ALGORITHM = 'AES-GCM';

// Converte ArrayBuffer para Base64 (URL Safe)
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Converte Base64 (URL Safe) para ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Standard = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(base64Standard);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptSecret(text: string): Promise<{ ciphertext: string, key: string, iv: string }> {
  // 1. Gerar uma chave AES-GCM de 256 bits
  const key = await window.crypto.subtle.generateKey(
    { name: ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Gerar um IV (Initialization Vector) randômico de 12 bytes
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Criptografar o texto
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  // 4. Exportar a chave para Base64 para colocar na URL
  const exportedKey = await window.crypto.subtle.exportKey('raw', key);

  return {
    ciphertext: bufferToBase64(encrypted),
    key: bufferToBase64(exportedKey),
    iv: bufferToBase64(iv.buffer)
  };
}

export async function decryptSecret(ciphertext: string, keyBase64: string, ivBase64: string): Promise<string> {
  // 1. Importar a chave de volta
  const keyBuffer = base64ToBuffer(keyBase64);
  const key = await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    ALGORITHM,
    true,
    ['decrypt']
  );

  // 2. Preparar o IV e o Ciphertext
  const iv = new Uint8Array(base64ToBuffer(ivBase64));
  const data = base64ToBuffer(ciphertext);

  // 3. Descriptografar
  const decrypted = await window.crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
