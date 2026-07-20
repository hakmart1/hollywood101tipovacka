// Normalize a user-supplied image/link URL. Keeps data:image/ and http(s) URLs
// as-is, and assumes https:// when no scheme is given (so users don't have to
// type it). Empty → null. Shared by movie posters and profile avatars.
export function normalizeUrl(value: unknown): string | null {
  const url = String(value || "").trim();
  if (!url) {
    return null;
  }
  if (url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}
