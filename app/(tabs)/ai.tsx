import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { CURRENT_BOOK, AI_MESSAGES, AI_RECOMMENDATIONS } from "../../src/data/mockData";

const BG = "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=1200&q=80";

type Tab = "Chat" | "Recommend" | "Define" | "Themes";
const TABS: Tab[] = ["Chat", "Recommend", "Define", "Themes"];

interface Message { id: string; role: "user" | "assistant"; text: string }

function SendIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.cream}>
      <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
  );
}

export default function AIScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("Chat");
  const [messages, setMessages] = useState<Message[]>(AI_MESSAGES);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    const msg = input.trim();
    if (!msg) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: msg };
    const aiReply: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      text: "That's a fascinating aspect of the book! The themes of regret and possibility run very deep in this chapter. Haig uses Nora's journey through the Midnight Library to explore how our small decisions ripple through our entire lives.",
    };
    setMessages((prev) => [...prev, userMsg, aiReply]);
    setInput("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13,11,10,0.65)" }]} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Header */}
        <View style={styles.aiHdr}>
          <Text style={styles.aiTitle}>Reading companion</Text>
          <TouchableOpacity style={styles.contextPill} activeOpacity={0.8}>
            <CoverImage uri={CURRENT_BOOK.cover} title={CURRENT_BOOK.title} style={styles.contextCover} />
            <Text style={styles.contextTxt} numberOfLines={1}>{CURRENT_BOOK.title}</Text>
            <Text style={styles.contextChange}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
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

        {/* Chat tab */}
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
          />
        )}

        {/* Recommend tab */}
        {activeTab === "Recommend" && (
          <FlatList
            data={AI_RECOMMENDATIONS}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            ListHeaderComponent={
              <Text style={styles.recHeader}>Based on your library and mood logs:</Text>
            }
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => (
              <View style={styles.recCard}>
                <CoverImage uri={item.cover} title={item.title} style={styles.recCover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{item.title}</Text>
                  <Text style={styles.recAuthor}>{item.author}</Text>
                  <Text style={styles.recWhy}>{item.reason}</Text>
                </View>
              </View>
            )}
          />
        )}

        {/* Define / Themes tabs — starter prompts */}
        {(activeTab === "Define" || activeTab === "Themes") && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.msgList}>
            <Text style={styles.starterLbl}>Try asking:</Text>
            {(activeTab === "Define"
              ? ["What does 'ephemeral' mean?", "Define 'soliloquy'", "What is 'bildungsroman'?"]
              : ["What symbols appear in this book?", "How does setting affect the story?", "What is the central conflict?"]
            ).map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.starterChip}
                onPress={() => { setActiveTab("Chat"); setInput(s); }}
              >
                <Text style={styles.starterText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input bar (only on chat/define/themes) */}
        {activeTab !== "Recommend" && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputField}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything about your book…"
              placeholderTextColor={colors.char3}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <SendIcon />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Need ScrollView for the starter prompts
import { ScrollView } from "react-native";

const styles = StyleSheet.create({
  aiHdr: {
    backgroundColor: colors.parchment, borderBottomWidth: 1, borderBottomColor: colors.cream3,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
  },
  aiTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, color: colors.espresso },
  contextPill: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
    alignSelf: "flex-start", marginTop: 8,
  },
  contextCover: { width: 22, height: 30, borderRadius: 2 },
  contextTxt: { fontSize: 12, color: colors.espresso2, fontWeight: "500", maxWidth: 160 },
  contextChange: { fontSize: 11, color: colors.terracotta },

  tabsRow: {
    flexDirection: "row", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
  },
  tab: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: 1, borderColor: colors.cream3, backgroundColor: colors.parchment,
  },
  tabActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  tabText: { fontSize: 12, fontWeight: "500", color: colors.char3 },
  tabTextActive: { color: colors.cream },

  msgList: { padding: 14, flexGrow: 1 },
  starterLbl: { fontSize: 12, color: colors.char3, marginBottom: 10 },
  starterChip: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  starterText: { fontSize: 13, color: colors.espresso },

  msgAI: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 12 },
  aiAv: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.espresso,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubbleAI: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 4, borderTopLeftRadius: 0, borderTopRightRadius: 14,
    borderBottomRightRadius: 14, borderBottomLeftRadius: 14,
    padding: 10, maxWidth: "78%",
  },
  bubbleAIText: { fontSize: 13, color: colors.espresso, lineHeight: 19 },
  bubbleUser: {
    backgroundColor: colors.espresso, borderRadius: 14, borderTopRightRadius: 4,
    padding: 10, maxWidth: "78%", alignSelf: "flex-end", marginBottom: 12,
  },
  bubbleUserText: { fontSize: 13, color: colors.cream, lineHeight: 19 },

  // Recommend
  recHeader: { fontSize: 12, color: colors.char3, padding: 14, paddingBottom: 4 },
  recCard: {
    flexDirection: "row", gap: 12,
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 12, marginHorizontal: 16, marginTop: 10,
  },
  recCover: { width: 46, height: 66, borderRadius: 5 },
  recTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 13, color: colors.espresso, marginBottom: 2 },
  recAuthor: { fontSize: 11, color: colors.char3, marginBottom: 4 },
  recWhy: { fontSize: 11, color: colors.terracotta, lineHeight: 15 },

  inputRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.cream3,
    alignItems: "center",
  },
  inputField: {
    flex: 1, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 13, color: colors.espresso,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.espresso,
    alignItems: "center", justifyContent: "center",
  },
});
