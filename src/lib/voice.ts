import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import { Book, Mood } from "../types";

const BUCKET = "voice-notes";

/** What supabase/functions/voice-note heard, for the reader to review. */
export interface VoiceNoteResult {
  transcript: string;
  mood: Mood | null;
  quote: string | null;
  page: number | null;
  thought: string | null;
}

/**
 * Upload a finished recording to the private bucket and return its path.
 *
 * Read through expo-file-system rather than fetch(): React Native's fetch
 * returns 0 bytes for file:// URIs, which would upload a silent, empty file.
 */
export async function uploadVoiceRecording(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "m4a";
  const storagePath = `${userId}/${Date.now()}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: "audio/mp4", upsert: false });
  if (error) throw error;
  return storagePath;
}

/** Transcribe and sort an uploaded recording. Saves nothing. */
export async function processVoiceNote(
  audioPath: string,
  book: Pick<Book, "title" | "author">
): Promise<VoiceNoteResult> {
  const { data, error } = await supabase.functions.invoke("voice-note", {
    body: { audioPath, book: { title: book.title, author: book.author } },
  });
  if (error) {
    // The function's own message ("today's limit…") is in the response body;
    // supabase-js only gives a generic "non-2xx status code" otherwise.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data as VoiceNoteResult;
}

export async function deleteVoiceRecording(audioPath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([audioPath]);
  if (error) throw error;
}

/** A playable link to a private recording, valid for an hour. */
export async function voiceNoteUrl(audioPath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(audioPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
