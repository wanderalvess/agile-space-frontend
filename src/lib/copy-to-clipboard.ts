'use client';

/**
 * Asynchronously copies a string to the clipboard.
 * Uses the modern Clipboard API (navigator.clipboard) with a fallback to the legacy document.execCommand('copy').
 *
 * @param text The string to be copied to the clipboard.
 * @returns A Promise that resolves to `true` if the copy operation was successful, and `false` otherwise.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // Modern browsers in a secure context (HTTPS) can use the Clipboard API.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Clipboard API failed. Falling back to execCommand.", error);
      // The fallback will be attempted below.
    }
  }

  // --- Fallback for older browsers or insecure contexts (HTTP) ---
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Make the textarea invisible and prevent screen from jumping
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    // document.execCommand returns a boolean indicating success.
    const successful = document.execCommand("copy");
    if (!successful) {
      console.error("Fallback execCommand('copy') was not successful.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Fallback execCommand('copy') failed.", error);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
};
