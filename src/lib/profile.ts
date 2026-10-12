import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

/**
 * The reader's profile beyond their name: kept in auth user_metadata next to
 * name, reading_goal and bio, so it needs no table of its own.
 */
export interface Profile {
  bio: string;
  pronouns: string;
  avatarUrl: string | null;
  socials: Socials;
}

export type SocialKind = "instagram" | "tiktok" | "twitter" | "goodreads";
export type Socials = Record<SocialKind, string>;

export const EMPTY_SOCIALS: Socials = { instagram: "", tiktok: "", twitter: "", goodreads: "" };

export function profileFromMeta(meta: Record<string, any> | undefined): Profile {
  const m = meta ?? {};
  return {
    bio: m.bio ?? "",
    pronouns: m.pronouns ?? "",
    avatarUrl: m.avatar_url ?? null,
    socials: { ...EMPTY_SOCIALS, ...(m.socials ?? {}) },
  };
}

export const SOCIALS: { kind: SocialKind; label: string; placeholder: string }[] = [
  { kind: "instagram", label: "Instagram", placeholder: "@yourname" },
  { kind: "tiktok", label: "TikTok", placeholder: "@yourname" },
  { kind: "twitter", label: "X (Twitter)", placeholder: "@yourname" },
  { kind: "goodreads", label: "Goodreads", placeholder: "Profile link" },
];

/**
 * "@name", "name" or a pasted profile link, stored as the reader typed it
 * minus surrounding space; turned into a link only when shown.
 */
export function socialUrl(kind: SocialKind, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "twitter":
      return `https://x.com/${handle}`;
    case "goodreads":
      // Goodreads profiles are numeric ids, not handles; without a link the
      // best we can do is their people search.
      return `https://www.goodreads.com/search?q=${encodeURIComponent(handle)}&search_type=people`;
  }
}

const BUCKET = "book-photos";

/**
 * Upload a profile photo and return its public URL.
 *
 * Shrunk to 512px square first: a phone photo is several megabytes, and the
 * avatar is never shown larger than ~90pt. The path's second segment is the
 * user id, which is what the bucket's upload policy checks.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<{ url: string; path: string }> {
  const small = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );

  const base64 = await FileSystem.readAsStringAsync(small.uri, { encoding: "base64" });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const path = `avatars/${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path };
}

/** Remove a previous avatar file, given its public URL. Best effort. */
export async function deleteAvatarByUrl(url: string | null): Promise<void> {
  if (!url) return;
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return;
  await supabase.storage.from(BUCKET).remove([url.slice(at + marker.length)]);
}
