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
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const storagePath = `gallery/${userId}/${Date.now()}.${ext}`;

  // 1. Read file as base64 via expo-file-system (fetch on file:// URIs returns 0 bytes in RN)
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: "base64",
  });

  // Convert base64 → Uint8Array for Supabase Storage
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 2. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) throw uploadError;

  // 3. Get the public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // 4. Insert metadata row (book_id is null — standalone gallery photo)
  const { data, error: dbError } = await supabase
    .from("photos")
    .insert({ user_id: userId, book_id: null, storage_path: storagePath, caption: caption || null })
    .select("id, caption, created_at")
    .single();

  if (dbError) {
    // Clean up the uploaded file if DB insert fails
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw dbError;
  }

  return {
    id: data.id,
    uri: urlData.publicUrl,
    caption: data.caption ?? "",
    storagePath,
    timestamp: new Date(data.created_at).getTime(),
  };
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

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteGalleryPhoto(id: string, storagePath: string): Promise<void> {
  // Remove file first, then the DB row (order doesn't matter much but storage first is safer)
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw error;
}
