// Gravatar derives the avatar from a hash of the e-mail. We store and expose
// only the hash (what Gravatar itself puts in a public URL), never the raw
// e-mail, so the leaderboard can show avatars without leaking addresses.
export async function gravatarHash(email: string | null): Promise<string | null> {
  if (!email) {
    return null;
  }
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
