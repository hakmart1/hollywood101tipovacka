// Gravatar derives the avatar from a hash of the e-mail — no upload/storage needed.
// d=404 makes Gravatar return an error when the user has none, so callers can fall
// back to an initials avatar via the <img> onError handler.
export async function gravatarUrl(email: string, size: number): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `https://www.gravatar.com/avatar/${hex}?s=${size}&d=404`;
}
