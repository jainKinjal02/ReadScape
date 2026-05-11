import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";

const BUCKET = "book-photos";

export interface PersistedPhoto {
  id: string;
  uri: string;          // public URL from Supabase Storage
  caption: string;
  storagePath: string;  // needed to delete from storage later
  timestamp: number;    // created_at as ms epoch
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export async function uploadGalleryPhoto(
  userId: string,
  localUri: string,
  caption: string
): Promise<PersistedPhoto> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `gallery/${userId}/${Date.now()}.${ext}`;
  return readAndUpload(userId, null, localUri, caption, storagePath);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchGalleryPhotos(userId: string): Promise<PersistedPhoto[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("id, storage_path, caption, created_at")
    .eq("user_id", userId)
    .is("book_id", null)               // standalone gallery photos only
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    uri: supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    caption: row.caption ?? "",
    storagePath: row.storage_path,
    timestamp: new Date(row.created_at).getTime(),
  }));
}

// ─── Book-specific photos ─────────────────────────────────────────────────────

async function readAndUpload(
  userId: string,
  bookId: string | null,
  localUri: string,
  caption: string,
  storagePath: string
): Promise<PersistedPhoto> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  // Step 1 — read file
  console.log("[Upload] reading file:", localUri);
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
  console.log("[Upload] file read OK, base64 length:", base64.length);

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  console.log("[Upload] bytes length:", bytes.length, "storagePath:", storagePath);

  // Step 2 — storage upload
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) {
    console.error("[Upload] storage error:", JSON.stringify(uploadError));
    throw uploadError;
  }
  console.log("[Upload] storage upload OK");

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // Step 3 — DB insert
  const { data, error: dbError } = await supabase
    .from("photos")
    .insert({ user_id: userId, book_id: bookId, storage_path: storagePath, caption: caption || null })
    .select("id, caption, created_at")
    .single();

  if (dbError) {
    console.error("[Upload] DB error:", JSON.stringify(dbError));
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw dbError;
  }
  console.log("[Upload] DB insert OK, id:", data.id);

  return {
    id: data.id,
    uri: urlData.publicUrl,
    caption: data.caption ?? "",
    storagePath,
    timestamp: new Date(data.created_at).getTime(),
  };
}

export async function uploadBookPhoto(
  userId: string,
  bookId: string,
  localUri: string,
  caption: string
): Promise<PersistedPhoto> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `books/${userId}/${bookId}-${Date.now()}.${ext}`;
  return readAndUpload(userId, bookId, localUri, caption, storagePath);
}

export async function fetchBookPhotos(bookId: string): Promise<PersistedPhoto[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("id, storage_path, caption, created_at")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    uri: supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    caption: row.caption ?? "",
    storagePath: row.storage_path,
    timestamp: new Date(row.created_at).getTime(),
  }));
}

// ─── Delete (shared by gallery and book photos) ───────────────────────────────

export async function deleteGalleryPhoto(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw error;
}
