import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fonts, moodConfig } from "../design/tokens";
import { toUserMessage } from "../lib/errors";
import { addNote, addQuote, logMood } from "../lib/books";
import {
  deleteVoiceRecording,
  formatDuration,
  processVoiceNote,
  uploadVoiceRecording,
} from "../lib/voice";
import { Book, Mood, Note, Quote } from "../types";

// Long enough to read a passage and say what it did to you; short enough that
// an accidental recording doesn't run up a transcription bill.
const MAX_MS = 3 * 60 * 1000;

// Speech needs far less than the HIGH_QUALITY preset's stereo 128kbps, and a
// smaller file uploads faster on a phone connection.
const VOICE_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

const MOODS: Mood[] = ["loving_it", "getting_into_it", "finished", "taking_a_break", "struggling"];

type Phase = "idle" | "recording" | "processing" | "review" | "saving";

export interface VoiceNoteSaved {
  note: Note;
  quote: Quote | null;
  mood: Mood | null;
}

/**
 * Speak how a book is making you feel; get a mood, a quote and a note back.
 *
 * An overlay rather than a Modal: iOS blocks network requests started from
 * inside a presented Modal, and this sheet uploads and saves from within.
 */
export function VoiceNoteSheet({
  book,
  userId,
  onClose,
  onSaved,
}: {
  book: Book;
  userId: string;
  onClose: () => void;
  onSaved: (saved: VoiceNoteSaved) => void;
}) {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(VOICE_PRESET);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [phase, setPhase] = useState<Phase>("idle");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [quote, setQuote] = useState("");
  const [page, setPage] = useState("");
  const [thought, setThought] = useState("");

  // Anything uploaded but not saved is removed on the way out.
  const unsaved = useRef<string | null>(null);
  useEffect(() => {
    unsaved.current = audioPath;
  }, [audioPath]);
  useEffect(() => {
    return () => {
      if (unsaved.current) deleteVoiceRecording(unsaved.current).catch(() => {});
      // Leave recording mode, or later playback comes out of the earpiece.
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []);

  // A slow pulse on the dot while listening.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase !== "recording") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const start = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Microphone is off",
        "Allow ReadScape to use the microphone in Settings to record voice notes."
      );
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("recording");
    } catch (e) {
      Alert.alert("Couldn't start recording", toUserMessage(e));
    }
  };

  // The limit effect and a tap can both land on the same stop.
  const stopping = useRef(false);

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      await finishRecording();
    } finally {
      stopping.current = false;
    }
  };

  const finishRecording = async () => {
    const elapsed = recorderState.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    if (!uri || elapsed < 1000) {
      // A tap-and-release, not a note.
      setPhase("idle");
      return;
    }
    setDurationMs(elapsed);
    setPhase("processing");

    let path: string | null = null;
    try {
      path = await uploadVoiceRecording(userId, uri);
      setAudioPath(path);
      const result = await processVoiceNote(path, book);
      if (!result.transcript) {
        await deleteVoiceRecording(path).catch(() => {});
        setAudioPath(null);
        Alert.alert("Didn't catch that", "No words came through. Try again a little closer to the phone.");
        setPhase("idle");
        return;
      }
      setTranscript(result.transcript);
      setMood(result.mood);
      setQuote(result.quote ?? "");
      setPage(result.page != null ? String(result.page) : "");
      setThought(result.thought ?? "");
      setPhase("review");
    } catch (e) {
      if (path) {
        await deleteVoiceRecording(path).catch(() => {});
        setAudioPath(null);
      }
      Alert.alert("Couldn't process that note", toUserMessage(e));
      setPhase("idle");
    }
  };

  // Stop on its own at the limit rather than recording forever.
  useEffect(() => {
    if (phase === "recording" && recorderState.durationMillis >= MAX_MS) stop();
  }, [phase, recorderState.durationMillis]);

  const close = async () => {
    if (phase === "recording") await recorder.stop().catch(() => {});
    onClose();
  };

  const save = async () => {
    if (!audioPath) return;
    setPhase("saving");
    try {
      // Every voice note keeps its recording, even when all it held was a
      // quote, so the transcript stands in for a missing thought.
      const note = await addNote(userId, book.id, thought.trim() || transcript, {
        path: audioPath,
        durationMs,
      });
      // The note owns the recording now; don't clean it up on close.
      unsaved.current = null;

      const quoteText = quote.trim();
      const pageNum = parseInt(page, 10);
      const savedQuote = quoteText
        ? await addQuote(userId, book.id, quoteText, Number.isFinite(pageNum) ? pageNum : null)
        : null;
      if (mood) await logMood(userId, book.id, mood, book.current_page || null);

      onSaved({ note, quote: savedQuote, mood });
    } catch (e) {
      Alert.alert("Couldn't save", toUserMessage(e));
      setPhase("review");
    }
  };

  const elapsed = phase === "recording" ? recorderState.durationMillis : durationMs;

  return (
    <View style={StyleSheet.absoluteFill}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop in normal flow above the sheet, so the keyboard can push
            the sheet up. Only closes before anything has been recorded. */}
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={phase === "idle" ? close : undefined}
        />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.pill} />

          {(phase === "idle" || phase === "recording") && (
            <View style={s.center}>
              <Text style={s.heading}>
                {phase === "idle" ? "Say how it feels" : "Listening…"}
              </Text>
              <Text style={s.sub}>
                {phase === "idle"
                  ? `Talk about ${book.title}: how it's landing, or read a line that stayed with you.`
                  : "Read a line aloud, or just talk. Tap when you're done."}
              </Text>

              <TouchableOpacity
                style={[s.mic, phase === "recording" && s.micOn]}
                onPress={phase === "idle" ? start : stop}
                activeOpacity={0.85}
                accessibilityLabel={phase === "idle" ? "Start recording" : "Stop recording"}
              >
                {phase === "idle" ? <MicIcon color={colors.paper} /> : <StopIcon />}
              </TouchableOpacity>

              <View style={s.timerRow}>
                {phase === "recording" && <Animated.View style={[s.dot, { opacity: pulse }]} />}
                <Text style={s.timer}>
                  {phase === "recording" ? formatDuration(elapsed) : "up to 3 minutes"}
                </Text>
              </View>

              <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === "processing" && (
            <View style={[s.center, { paddingVertical: 36 }]}>
              <ActivityIndicator color={colors.ink} />
              <Text style={[s.sub, { marginTop: 14 }]}>Listening back…</Text>
            </View>
          )}

          {(phase === "review" || phase === "saving") && (
            <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.heading}>Here's what I heard</Text>
              <Text style={[s.sub, { textAlign: "left" }]}>Change anything before it's saved.</Text>

              <Text style={s.label}>HOW IT FELT</Text>
              <View style={s.chips}>
                {MOODS.map((m) => {
                  const on = mood === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.chip, on && s.chipOn]}
                      onPress={() => setMood(on ? null : m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>
                        {moodConfig[m].label.toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>QUOTE</Text>
              <TextInput
                style={[s.input, s.quoteInput]}
                value={quote}
                onChangeText={setQuote}
                placeholder="No quote this time"
                placeholderTextColor={colors.pencil2}
                multiline
              />
              {!!quote.trim() && (
                <TextInput
                  style={[s.input, s.pageInput]}
                  value={page}
                  onChangeText={setPage}
                  placeholder="page"
                  placeholderTextColor={colors.pencil2}
                  keyboardType="number-pad"
                />
              )}

              <Text style={s.label}>YOUR THOUGHT</Text>
              <TextInput
                style={s.input}
                value={thought}
                onChangeText={setThought}
                placeholder={transcript}
                placeholderTextColor={colors.pencil2}
                multiline
              />

              <View style={s.voiceRow}>
                <MicIcon color={colors.pencil} size={12} />
                <Text style={s.voiceText}>Recording kept · {formatDuration(durationMs)}</Text>
              </View>

              <View style={s.actions}>
                <TouchableOpacity
                  style={s.ghost}
                  onPress={close}
                  disabled={phase === "saving"}
                  activeOpacity={0.8}
                >
                  <Text style={s.ghostText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primary, phase === "saving" && { opacity: 0.6 }]}
                  onPress={save}
                  disabled={phase === "saving"}
                  activeOpacity={0.85}
                >
                  {phase === "saving" ? (
                    <ActivityIndicator color={colors.paper} size="small" />
                  ) : (
                    <Text style={s.primaryText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function MicIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={1.6} />
      <Path
        d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function StopIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={5} y={5} width={14} height={14} rx={2} fill={colors.paper} />
    </Svg>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(27,26,34,0.35)" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 22,
  },
  pill: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.rule, alignSelf: "center", marginBottom: 14 },
  center: { alignItems: "center", paddingBottom: 6 },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: 6 },
  sub: {
    fontFamily: fonts.body, fontSize: 13, color: colors.pencil,
    lineHeight: 19, textAlign: "center", maxWidth: 300,
  },

  mic: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.ink,
    alignItems: "center", justifyContent: "center", marginTop: 26,
  },
  micOn: { backgroundColor: colors.danger },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, height: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  timer: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pencil, fontVariant: ["tabular-nums"] },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.pencil, marginTop: 22, marginBottom: 4 },

  label: {
    fontFamily: fonts.bodySemi, fontSize: 10.5, color: colors.pencil,
    letterSpacing: 0.8, marginTop: 20, marginBottom: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.rule, borderRadius: 2, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.mark },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.pencil },
  chipTextOn: { color: colors.markInk },

  input: {
    fontFamily: fonts.reading, fontSize: 14, color: colors.ink, lineHeight: 21,
    borderWidth: 1, borderColor: colors.rule, borderRadius: 4, backgroundColor: colors.card,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, minHeight: 64,
    textAlignVertical: "top",
  },
  quoteInput: { fontFamily: fonts.readingItalic },
  pageInput: { fontFamily: fonts.body, minHeight: 0, width: 90, marginTop: 8, paddingVertical: 8 },

  voiceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  voiceText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil },

  actions: { flexDirection: "row", gap: 9, marginTop: 20 },
  primary: { flex: 1, backgroundColor: colors.ink, borderRadius: 2, paddingVertical: 13, alignItems: "center" },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper },
  ghost: {
    flex: 1, borderRadius: 2, paddingVertical: 13, alignItems: "center",
    borderWidth: 1, borderColor: colors.ruleStrong,
  },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
});
