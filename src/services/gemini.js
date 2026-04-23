// ─── Client-side file reading utilities ───────────────────────
// All AI processing is routed through the secure backend API.
// The Gemini API key NEVER touches the client bundle.

import { backendApi } from './backendApi';

/**
 * Parse a file via the backend Gemini proxy.
 * Replaces the old direct-to-Gemini client call.
 */
export async function callGeminiWithFile(fileContent, fileType, fileName) {
  return backendApi.parseDocument(fileContent, fileType, fileName);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export const priorityStyle = {
  critical: { bg: "#FFF0F0", color: "#B91C1C", border: "#FCA5A5" },
  urgent:   { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  high:     { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  medium:   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  low:      { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
};
