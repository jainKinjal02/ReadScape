import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/design/tokens";
import { Book } from "../../src/types";

// IMPORTANT: Replace with your actual Supabase project URL
// This calls your Edge Function, NOT Anthropic directly.
// The Anthropic API key lives only in the Edge Function environment.
const EDGE_FN_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-companion`
  : "";

type AiMode = "chat" | "define" | "recommend";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const MODE_PLACEHOLDERS: Record<AiMode, string> = {
  chat: "Ask anything about your book...",
  define: "Enter a word to look up...",
  recommend: "Describe what you're in the mood for...",
};

const MODE_STARTERS: Record<AiMode, string[]> = {
  chat: [
    "What are the major themes?",
    "Tell me about the author",
    "Explain this character's motivation",
  ],
  define: ["What does 'ephemeral' mean?", "Define 'soliloquy'", "What is 'bildungsroman'?"],
  recommend: [
    "Something similar to this book",
    "A cozy read for a rainy day",
    "A challenging literary novel",
  ],
};

export default function AICompanionScreen() {
  const { userId } = useAppStore();
  const [mode, setMode] = useState<AiMode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [lastMood, setLastMood] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId) return;
    // Fetch currently reading book for context
    supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "reading")
      .limit(1)
      .single()
      .then(({ data }) => setCurrentBook(data as Book ?? null));

    // Fetch last mood
    supabase
      .from("mood_logs")
      .select("mood")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setLastMood(data?.mood ?? null));
  }, [userId]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Get the session token to authenticate the Edge Function call
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          message: msg,
          mode,
          bookContext: currentBook
            ? {
                title: currentBook.title,
                author: currentBook.author,
                currentPage: currentBook.current_page,
                totalPages: currentBook.total_pages,
                lastMood,
              }
            : null,
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.reply ?? "I couldn't get a response. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "Something went wrong. Make sure your Supabase Edge Function is deployed.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>AI Companion</Text>
        {/* Context pill */}
        {currentBook && (
          <View style={styles.contextPill}>
            <Text style={styles.contextText} numberOfLines={1}>
              📖 {currentBook.title}
              {currentBook.current_page ? ` · p.${currentBook.current_page}` : ""}
              {lastMood ? ` · ${lastMood.replace("_", " ")}` : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        {(["chat", "define", "recommend"] as AiMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeTab, mode === m && styles.modeTabActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
              {m === "chat" ? "💬 Chat" : m === "define" ? "📖 Define" : "✨ Recommend"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.startersContainer}>
            <Text style={styles.startersLabel}>Try asking:</Text>
            {MODE_STARTERS[mode].map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.starterChip}
                onPress={() => sendMessage(s)}
              >
                <Text style={styles.starterText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.role === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            {item.role === "assistant" && (
              <Text style={styles.aiLabel}>✨ ReadScape AI</Text>
            )}
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
      />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.roseAccent} />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder={MODE_PLACEHOLDERS[mode]}
          placeholderTextColor={colors.inkMuted}
          multiline
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: colors.inkPrimary,
    marginBottom: 8,
  },
  contextPill: {
    backgroundColor: colors.bgSurface,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  contextText: { fontSize: 12, color: colors.inkMuted },
  modeTabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    alignItems: "center",
  },
  modeTabActive: { backgroundColor: colors.roseSoft, borderWidth: 1.5, borderColor: colors.roseAccent },
  modeTabText: { fontSize: 12, color: colors.inkMuted, fontWeight: "500" },
  modeTabTextActive: { color: colors.roseAccent, fontWeight: "700" },
  messageList: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
  startersContainer: { padding: 16 },
  startersLabel: { fontSize: 13, color: colors.inkMuted, marginBottom: 12 },
  starterChip: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  starterText: { fontSize: 14, color: colors.inkPrimary },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: colors.roseAccent,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.bgCard,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  aiLabel: { fontSize: 10, color: colors.roseAccent, fontWeight: "700", marginBottom: 4 },
  messageText: { fontSize: 14, color: colors.inkPrimary, lineHeight: 20 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: colors.inkMuted },
  inputBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.bgSurface,
    gap: 8,
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.inkPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.roseAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
});
