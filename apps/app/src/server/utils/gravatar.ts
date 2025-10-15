import { createHash } from "node:crypto";

/**
 * Generate a Gravatar URL from an email address
 * Server-side only - uses Node.js crypto module
 * @param email - The email address
 * @param size - The size of the avatar (default: 200)
 * @returns The Gravatar URL
 */
export function getGravatarUrl(email: string, size = 200): string {
  if (!email) return "";

  const hash = createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");

  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}
