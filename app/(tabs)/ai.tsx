import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";

const BG = "https://images.unsplash.com/photo-1476275466078-4cdc48d9e56f?w=1200&q=80";

const HEADER_IMGS = [
  "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&q=80",
  "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&q=80",
  "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80",
];

type Tab = "Chat" | "Recommend" | "Define" | "Themes";
const TABS: Tab[] = ["Chat", "Recommend", "Define", "Themes"];

// Map UI tab → Edge Function mode
const TAB_MODE: Record<Tab, string> = {
  Chat:      "chat",
  Recommend: "recommend",
  Define:    "define",
  Themes:    "themes",
};

const STARTERS: Record<Tab, string[]> = {
  Chat: [],
  Recommend: [
    "Recommend something similar to what I'm currently reading",
    "What should I read after finishing a thriller?",
    "Suggest a book for when I'm in a contemplative mood",
    "What's a good short read I can finish this week?",
  ],
  Define: [
    "What does 'ephemeral' mean?",
    "Define 'soliloquy'",
    "What is 'bildungsroman'?",
    "What does 'unreliable narrator' mean?",
  ],
  Themes: [
    "What symbols appear in this book?",
    "How does the setting shape the story?",
    "What is the central conflict?",
    "How does the author use foreshadowing?",
  ],
};

const WELCOME_MSG = {
  id: "welcome",
  role: "assistant" as const,
  text: "Hello! I'm your reading companion. Ask me anything about the books you're reading — themes, characters, definitions, or what to read next.",
};

interface Message { id: string; role: "user" | "assistant"; text: string }

function SendIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.cream}>
      <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
  );
}

// Three-dot typing indicator
function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((dots.length - i) * 160),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.msgAI}>
      <View style={styles.aiAv}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={colors.cream} strokeWidth={1.5} />
        </Svg>
      </View>
      <View style={styles.bubbleAI}>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center", paddingVertical: 4 }}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: colors.terracotta,
                opacity: dot,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const books = useAppStore((s) => s.books);
  const [activeTab, setActiveTab] = useState<Tab>("Chat");
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Current book context — first book with status "reading"
  const currentBook = books.find((b) => b.status === "reading") ?? null;
  const bookContext = currentBook
    ? {
        title: currentBook.title,
        author: currentBook.author ?? "Unknown",
        currentPage: currentBook.current_page,
        totalPages: currentBook.total_pages,
      }
    : null;

  // Crossfading header images
  const opacities = useRef(HEADER_IMGS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const currentIdx = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = currentIdx.current;
      const nxt = (cur + 1) % HEADER_IMGS.length;
      Animated.parallel([
        Animated.timing(opacities[cur], { toValue: 0, duration: 1800, useNativeDriver: true }),
        Animated.timing(opacities[nxt], { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]).start(() => { currentIdx.current = nxt; });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveTab("Chat");
    setIsLoading(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error } = await supabase.functions.invoke("ai-companion", {
        body: {
          message: msg,
          mode: TAB_MODE[activeTab],
          bookContext,
        },
      });

      if (error) throw error;

      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data?.reply ?? "Sorry, I couldn't get a response. Please try again.",
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "I'm having trouble connecting right now. Please check your connection and try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const starters = STARTERS[activeTab];

  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,35,0.72)" }]} />

      {/* ── Atmospheric hero header ── */}
      <View style={styles.heroHeader}>
        {HEADER_IMGS.map((src, i) => (
          <Animated.View key={src} style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}>
            <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        ))}
        <LinearGradient
          colors={["rgba(44,31,20,0.55)", "rgba(44,31,20,0.35)", "rgba(15,25,35,0.85)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.heroTitle}>Reading Companion</Text>
          {bookContext ? (
            <Text style={styles.heroSub}>Reading: {bookContext.title}</Text>
          ) : (
            <Text style={styles.heroSub}>Ask anything about your books</Text>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom + 52 : 0}
        >
          {/* Tab bar */}
          <View style={styles.tabsRow}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chat messages */}
          {activeTab === "Chat" && (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.msgList}
              renderItem={({ item }) =>
                item.role === "assistant" ? (
                  <View style={styles.msgAI}>
                    <View style={styles.aiAv}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={colors.cream} strokeWidth={1.5} />
                      </Svg>
                    </View>
                    <View style={styles.bubbleAI}>
                      <Text style={styles.bubbleAIText}>{item.text}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.bubbleUser}>
                    <Text style={styles.bubbleUserText}>{item.text}</Text>
                  </View>
                )
              }
              ListFooterComponent={isLoading ? <TypingIndicator /> : null}
            />
          )}

          {/* Starter prompts for Recommend / Define / Themes */}
          {activeTab !== "Chat" && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.starterList}>
              <Text style={styles.starterLbl}>Try asking:</Text>
              {starters.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.starterChip}
                  onPress={() => sendMessage(s)}
                >
                  <Text style={styles.starterText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Input bar */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputField}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything about your book…"
              placeholderTextColor={colors.char3}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isLoading) && { opacity: 0.4 }]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || isLoading}
            >
              <SendIcon />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Atmospheric hero header
  heroHeader: { height: 170, overflow: "hidden", justifyContent: "flex-end" },
  heroContent: { paddingHorizontal: 20, paddingBottom: 16 },
  heroTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#faf6f0" },
  heroSub: { fontSize: 13, color: "rgba(247,242,235,0.75)", marginTop: 3 },

  // Tab bar — frosted glass on dark background
  tabsRow: {
    flexDirection: "row", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "rgba(15,25,35,0.6)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  tabActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  tabText: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.65)" },
  tabTextActive: { color: "#fff" },

  // Messages
  msgList: { padding: 14, flexGrow: 1 },
  msgAI: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 12 },
  aiAv: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.terracotta,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubbleAI: {
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 4, borderTopLeftRadius: 0, borderTopRightRadius: 14,
    borderBottomRightRadius: 14, borderBottomLeftRadius: 14,
    padding: 12, maxWidth: "78%",
  },
  bubbleAIText: { fontSize: 13, color: colors.espresso, lineHeight: 20 },
  bubbleUser: {
    backgroundColor: colors.terracotta,
    borderRadius: 14, borderTopRightRadius: 4,
    padding: 12, maxWidth: "78%", alignSelf: "flex-end", marginBottom: 12,
  },
  bubbleUserText: { fontSize: 13, color: "#fff", lineHeight: 20 },

  // Starter prompts
  starterList: { padding: 16 },
  starterLbl: { fontSize: 12, color: colors.char3, marginBottom: 10 },
  starterChip: {
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  starterText: { fontSize: 13, color: colors.espresso, lineHeight: 18 },

  // Input bar
  inputRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: colors.cream3,
    backgroundColor: colors.cream,
    alignItems: "center",
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 13, color: colors.espresso,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.terracotta,
    alignItems: "center", justifyContent: "center",
  },
});
