import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useRef, useEffect, useState } from "react";
import {
  useWindowDimensions,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Modal,
  Dimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, moodConfig } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { useAppStore } from "../../src/store";
import { useBooks } from "../../src/hooks/useBooks";
import { fetchMoodLogs } from "../../src/lib/books";
import { useReadingStreak } from "../../src/hooks/useReadingStreak";
import { Book } from "../../src/types";
import { supabase } from "../../src/lib/supabase";

const { width: SW } = Dimensions.get("window");
const PANEL_W = SW * 0.78;
// Currently-reading carousel card width — leaves a sliver of the next card peeking
const CUR_CARD_W = SW * 0.82;

// Atmospheric header background images



export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userName = useAppStore((s) => s.userName);
  const streak = useAppStore((s) => s.streak);
  const readingGoal = useAppStore((s) => s.readingGoal);
  const userBio = useAppStore((s) => s.userBio);
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);
  const setReadingGoal = useAppStore((s) => s.setReadingGoal);
  const setUserBio = useAppStore((s) => s.setUserBio);
  const { width: winW } = useWindowDimensions();
  // Reference gutter is 23px on a 352px frame (~6.5%). Scale it, then clamp so
  // it never crowds a small phone or drifts wide on a tablet or browser.
  const gutter = Math.round(Math.min(30, Math.max(18, winW * 0.065)));

  // Goal marks are sized to the width rather than fixed at the reference's 4px.
  // At a fixed width a 50-book goal orphans one or two marks onto a second row
  // on a 375pt phone, which reads as a mistake. Splitting into equal rows and
  // sizing to fit keeps every row deliberate at any width.
  const TICK_GAP = 2.6;
  const tickRowW = winW - gutter * 2;
  const tickRows = Math.max(
    1,
    Math.ceil(readingGoal / Math.max(1, Math.floor((tickRowW + TICK_GAP) / (4 + TICK_GAP))))
  );
  const ticksPerRow = Math.ceil(readingGoal / tickRows);
  const tickW = Math.min(
    10,
    // the 0.02 shaves a hair off so floating-point rounding cannot force a wrap
    Math.max(4, (tickRowW - TICK_GAP * (ticksPerRow - 1)) / ticksPerRow - 0.02)
  );

  const userId = useAppStore((s) => s.userId);
  const { books } = useBooks();
  useReadingStreak(); // keeps `streak` derived from real reading activity

  // Derive real data from Supabase books
  const readingBooks = books.filter((b) => b.status === "reading");
  const wantToRead = books.filter((b) => b.status === "want_to_read").slice(0, 5);
  const readCount = books.filter((b) => b.status === "read").length;
  const currentYear = new Date().getFullYear();
  const booksReadThisYear = books.filter((b) => {
    if (b.status !== "read") return false;
    if (!b.date_finished) return true; // no finish date — assume current year
    return new Date(b.date_finished).getFullYear() === currentYear;
  }).length;
  const goalPct = readingGoal > 0 ? Math.min(100, Math.round((booksReadThisYear / readingGoal) * 100)) : 0;

  // Derive initials from the real user name (first letter of each word, max 2)
  const initials = userName
    ? userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // ── Profile panel ─────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const panelAnim = useRef(new Animated.Value(PANEL_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openPanel = () => {
    setPanelOpen(true);
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 14 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closePanel = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(panelAnim, { toValue: PANEL_W, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setPanelOpen(false);
      onDone?.();
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setUserId(null);
    setUserName("");
    setLoggingOut(false);
    closePanel(() => router.replace("/"));
  };

  // ── Edit Profile ──────────────────────────────────────────────────────────
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editFocused, setEditFocused] = useState<string | null>(null);

  const openEditProfile = () => {
    setEditName(userName);
    setEditGoal(readingGoal > 0 ? String(readingGoal) : "");
    setEditBio(userBio);
    closePanel(() => setEditProfileOpen(true));
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: editName.trim(),
          reading_goal: Number(editGoal) || 0,
          bio: editBio.trim(),
        },
      });
      if (error) throw error;
      setUserName(editName.trim());
      setReadingGoal(Number(editGoal) || 0);
      setUserBio(editBio.trim());
      setEditProfileOpen(false);
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? "Try again.");
    } finally {
      setSavingProfile(false);
    }
  };


  // Latest logged mood per book. The reference puts this on the home card on
  // purpose: every tracker shows status and stars, this is the only one that
  // can show how a book *felt*.
  const [latestMoods, setLatestMoods] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMoodLogs(userId)
      .then((logs) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        // Newest first, so the first entry seen for a book is its latest mood.
        for (const l of logs) if (!map[l.book_id]) map[l.book_id] = l.mood;
        setLatestMoods(map);
      })
      .catch(() => {
        // Non-fatal: the card simply renders without a mood chip.
      });
    return () => { cancelled = true; };
  }, [userId]);

  const current = readingBooks[0] ?? null;

  // Most recently finished first. Undated finishes sort last rather than
  // being dropped — older rows predate the date_finished column.
  const recentlyFinished = books
    .filter((b) => b.status === "read")
    .sort((a, b) => {
      const ta = a.date_finished ? new Date(a.date_finished).getTime() : 0;
      const tb = b.date_finished ? new Date(b.date_finished).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 10);
  const lovedCount = books.filter((b) => b.is_favorite).length;
  const waitingCount = books.filter((b) => b.status === "want_to_read").length;

  const currentPct =
    current?.total_pages && current.total_pages > 0
      ? Math.min(100, Math.round((current.current_page / current.total_pages) * 100))
      : 0;

  const currentMeta = (() => {
    if (!current) return "";
    const parts: string[] = [];
    if (current.current_page > 0) parts.push(`page ${current.current_page}`);
    if (current.date_started) {
      const days = Math.max(
        0,
        Math.floor((Date.now() - new Date(current.date_started).getTime()) / 86400000)
      );
      parts.push(days === 0 ? "started today" : days === 1 ? "one day in" : `${days} days in`);
    }
    return parts.join(", ");
  })();

  const currentMood = current ? moodConfig[latestMoods[current.id]]?.label : undefined;

  const greeting = getGreeting();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: gutter,
            paddingTop: insets.top + 10,
            paddingBottom: 28 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Masthead ── */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name} numberOfLines={1}>{userName || "Reader"}</Text>
          </View>
          {/* The reference has no avatar, but profile and sign-out have to live
              somewhere, so it borrows the outlined circle from its own "+" button. */}
          <TouchableOpacity style={styles.avatar} onPress={openPanel} activeOpacity={0.7}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Now reading ── */}
        <View style={styles.ruleStrong} />
        {current ? (
          <TouchableOpacity
            style={styles.now}
            activeOpacity={0.85}
            onPress={() => router.push(`/book/${current.id}`)}
          >
            <View style={styles.nowCover}>
              <CoverImage uri={current.cover_url ?? ""} title={current.title} style={styles.nowCoverImg} />
            </View>
            <View style={styles.nowBody}>
              <Text style={styles.nowTitle} numberOfLines={2}>{current.title}</Text>
              {!!current.author && (
                <Text style={styles.nowAuthor} numberOfLines={1}>{current.author}</Text>
              )}
              <View style={styles.prog}>
                <View style={[styles.progFill, { width: `${currentPct}%` }]} />
              </View>
              {!!currentMeta && <Text style={styles.nowMeta}>{currentMeta}</Text>}
              {!!currentMood && (
                <View style={styles.chipsRow}>
                  <View style={styles.chipMark}>
                    <Text style={styles.chipMarkText}>{currentMood.toLowerCase()}</Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nowEmpty}
            activeOpacity={0.85}
            onPress={() => router.push("/(tabs)/library")}
          >
            <Text style={styles.nowEmptyTitle}>Nothing on the go</Text>
            <Text style={styles.nowEmptySub}>
              Mark a book as reading and it will sit here, with where you are in it.
            </Text>
          </TouchableOpacity>
        )}

        {/* ── The numbers ── */}
        <View style={styles.divide}>
          <View style={styles.nums}>
            <View style={styles.numCell}>
              <Text style={styles.numV}>{readCount}</Text>
              <Text style={styles.numL}>read</Text>
            </View>
            <View style={styles.numCell}>
              <Text style={styles.numV}>{lovedCount}</Text>
              <Text style={styles.numL}>loved</Text>
            </View>
            <View style={styles.numCell}>
              <Text style={styles.numV}>{waitingCount}</Text>
              <Text style={styles.numL}>waiting</Text>
            </View>
            {streak > 0 && (
              <View style={styles.numCell}>
                <Text style={styles.numV}>{streak}</Text>
                <Text style={styles.numL}>day streak</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── The year, as marks you can count ── */}
        <View style={styles.divide}>
          {readingGoal > 0 ? (
            <>
              <View style={styles.head}>
                <Text style={styles.h2}>{goalHeading(readingGoal)}</Text>
                <Text style={styles.xs}>{booksReadThisYear} done</Text>
              </View>
              {/* One mark per book. A bar says "62%"; this says "you can see
                  exactly how many are left", which is the point. */}
              <View style={styles.ticks}>
                {Array.from({ length: readingGoal }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tick,
                      { width: tickW },
                      i < booksReadThisYear && styles.tickOn,
                      i === booksReadThisYear && styles.tickCur,
                    ]}
                  />
                ))}
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.head} onPress={openEditProfile} activeOpacity={0.7}>
              <Text style={styles.h2}>Set a goal for {currentYear}</Text>
              <Text style={styles.xs}>add →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Waiting for you ── */}
        <View style={styles.divide}>
          <View style={styles.head}>
            <Text style={styles.h2}>Waiting for you</Text>
            {wantToRead.length > 0 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/library")}>
                <Text style={styles.xs}>see all</Text>
              </TouchableOpacity>
            )}
          </View>
          {wantToRead.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -gutter }}
              contentContainerStyle={[styles.strip, { paddingHorizontal: gutter }]}
            >
              {wantToRead.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.stripItem}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/book/${b.id}`)}
                >
                  <CoverImage uri={b.cover_url ?? ""} title={b.title} style={styles.stripCover} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.stripEmpty}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/library")}
            >
              <Text style={styles.stripEmptyText}>+  add a book you mean to read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Recently finished ── */}
        {recentlyFinished.length > 0 && (
          <View style={styles.divide}>
            <View style={styles.head}>
              <Text style={styles.h2}>Behind you</Text>
              <Text style={styles.xs}>{readCount} finished</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -gutter }}
              contentContainerStyle={[styles.strip, { paddingHorizontal: gutter }]}
            >
              {recentlyFinished.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.stripItem}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/book/${b.id}`)}
                >
                  <CoverImage uri={b.cover_url ?? ""} title={b.title} style={styles.stripCover} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Profile slide-in panel ── */}
      <Modal visible={panelOpen} transparent animationType="none" onRequestClose={() => closePanel()}>
        {/* Dim overlay — tap to close */}
        <Animated.View
          style={[styles.overlay, { opacity: overlayAnim }]}
          pointerEvents={panelOpen ? "auto" : "none"}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closePanel()} />
        </Animated.View>

        {/* Panel slides in from right */}
        <Animated.View style={[styles.panel, { transform: [{ translateX: panelAnim }] }]}>
          {/* Header area with gradient */}
          <LinearGradient
            colors={[colors.card, colors.paper]}
            style={styles.panelHeader}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={() => closePanel()} activeOpacity={0.7}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>

            {/* Avatar */}
            <View style={styles.panelAvatar}>
              <Text style={styles.panelAvatarText}>{initials}</Text>
            </View>
            <Text style={styles.panelName}>{userName || "Reader"}</Text>
            <View style={styles.panelBadge}>
              <Text style={styles.panelBadgeText}>ReadScape Member</Text>
            </View>
          </LinearGradient>

          {/* Stats strip */}
          <View style={styles.panelStats}>
            <View style={styles.panelStat}>
              <Text style={styles.panelStatV}>{readCount}</Text>
              <Text style={styles.panelStatL}>Books read</Text>
            </View>
            <View style={styles.panelStatDivider} />
            <View style={styles.panelStat}>
              <Text style={styles.panelStatV}>{streak}</Text>
              <Text style={styles.panelStatL}>Day streak</Text>
            </View>
            <View style={styles.panelStatDivider} />
            <View style={styles.panelStat}>
              <Text style={styles.panelStatV}>{books.length}</Text>
              <Text style={styles.panelStatL}>In library</Text>
            </View>
          </View>

          {/* Menu items */}
          <View style={styles.panelMenu}>
            <PanelRow icon="✏️" label="Edit Profile" onPress={openEditProfile} />
            <PanelRow icon="📚" label="My Library" onPress={() => closePanel(() => router.push("/(tabs)/library"))} />
            <PanelRow icon="✦" label="AI Companion" onPress={() => closePanel(() => router.push("/(tabs)/ai"))} />
            <PanelRow icon="📊" label="Insights" onPress={() => closePanel(() => router.push("/(tabs)/insights"))} />
          </View>

          {/* Push logout to the bottom */}
          <View style={{ flex: 1 }} />

          {/* Divider */}
          <View style={styles.panelDivider} />

          {/* Log Out */}
          <TouchableOpacity
            style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    stroke={colors.danger}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.logoutText}>Log Out</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* ── Edit Profile Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={editProfileOpen}
        animationType="slide"
        onRequestClose={() => setEditProfileOpen(false)}
      >
        <View style={[styles.editScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

          {/* Header — outside ScrollView, padded by real inset value */}
          <View style={styles.editHeader}>
            <TouchableOpacity
              style={styles.editBackBtn}
              onPress={() => setEditProfileOpen(false)}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke={colors.espresso2}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <View style={{ width: 34 }} />
          </View>

          {/* Scrollable form — KeyboardAvoidingView wraps only this part */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Avatar preview */}
              <View style={styles.editAvatarWrap}>
                <View style={styles.editAvatar}>
                  <Text style={styles.editAvatarText}>
                    {editName.trim()
                      ? editName.trim().split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                      : initials}
                  </Text>
                </View>
              </View>

              {/* Form fields */}
              <View style={styles.editForm}>
                {/* Name */}
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>YOUR NAME</Text>
                  <TextInput
                    style={[styles.editInput, editFocused === "name" && styles.editInputFocused]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Your display name"
                    placeholderTextColor={colors.char3}
                    autoCapitalize="words"
                    onFocus={() => setEditFocused("name")}
                    onBlur={() => setEditFocused(null)}
                  />
                </View>

                {/* Reading goal */}
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>READING GOAL</Text>
                  <Text style={styles.editLabelSub}>How many books do you want to read this year?</Text>
                  <TextInput
                    style={[styles.editInput, editFocused === "goal" && styles.editInputFocused]}
                    value={editGoal}
                    onChangeText={setEditGoal}
                    placeholder="e.g. 20"
                    placeholderTextColor={colors.char3}
                    keyboardType="number-pad"
                    onFocus={() => setEditFocused("goal")}
                    onBlur={() => setEditFocused(null)}
                  />
                </View>

                {/* Bio */}
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>BIO</Text>
                  <Text style={styles.editLabelSub}>A short note about your reading taste</Text>
                  <TextInput
                    style={[
                      styles.editInput,
                      styles.editBioInput,
                      editFocused === "bio" && styles.editInputFocused,
                    ]}
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="e.g. Lover of quiet fiction and late-night thrillers…"
                    placeholderTextColor={colors.char3}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    onFocus={() => setEditFocused("bio")}
                    onBlur={() => setEditFocused(null)}
                  />
                </View>

                {/* Save */}
                <TouchableOpacity
                  style={[styles.saveBtn, savingProfile && { opacity: 0.65 }]}
                  onPress={saveProfile}
                  disabled={savingProfile}
                  activeOpacity={0.85}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function PanelRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.panelRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.panelRowIcon}>{icon}</Text>
      <Text style={styles.panelRowLabel}>{label}</Text>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: "auto" }}>
        <Path d="M9 18l6-6-6-6" stroke={colors.char3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// "Fifty this year" reads like a sentence; "50 this year" reads like a form
// field. Words up to 100, numerals beyond — nobody sets a goal of 137.
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function numberToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n === 100) return "a hundred";
  if (n > 100) return String(n);
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10;
  return o === 0 ? t : `${t}-${ONES[o]}`;
}

function goalHeading(goal: number): string {
  const w = numberToWords(goal);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} this year`;
}

const TICK_GAP_STYLE = 2.6;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  // ── Paper & Ink home ──
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  greeting: { fontFamily: fonts.body, fontSize: 12.5, color: colors.pencil },
  name: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.ink,
    marginTop: 2,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.3, borderColor: colors.ink,
    alignItems: "center", justifyContent: "center",
    marginTop: 6,
  },
  avatarText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },

  // A heavier rule than the hairlines below it — this is the masthead break.
  ruleStrong: { borderTopWidth: 1.5, borderTopColor: colors.ink },
  divide: { borderTopWidth: 1, borderTopColor: colors.rule, marginTop: 19, paddingTop: 18 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
  h2: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  xs: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil },

  now: { flexDirection: "row", gap: 15, paddingTop: 17 },
  nowCover: {
    width: 70, aspectRatio: 2 / 3, borderRadius: 3, overflow: "hidden",
    shadowColor: colors.ink, shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 4,
  },
  nowCoverImg: { width: "100%", height: "100%" },
  nowBody: { flex: 1, minWidth: 0 },
  nowTitle: { fontFamily: fonts.display, fontSize: 15.5, lineHeight: 19, color: colors.ink },
  nowAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.pencil, marginTop: 3 },
  prog: { height: 2, backgroundColor: colors.rule, marginTop: 12 },
  progFill: { height: 2, backgroundColor: colors.ink },
  nowMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil, marginTop: 7 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 9 },
  chipMark: { backgroundColor: colors.mark, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3.5 },
  chipMarkText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.markInk },

  nowEmpty: { paddingTop: 20, paddingBottom: 4 },
  nowEmptyTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  nowEmptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.pencil, marginTop: 5, lineHeight: 17 },

  // Wraps rather than overflowing once the streak makes it four cells.
  nums: { flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 14 },
  numCell: {},
  numV: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: colors.ink },
  numL: { fontFamily: fonts.body, fontSize: 10.5, color: colors.pencil, marginTop: 3 },

  ticks: { flexDirection: "row", flexWrap: "wrap", gap: TICK_GAP_STYLE },
  tick: { height: 18, borderRadius: 1, backgroundColor: colors.rule },
  tickOn: { backgroundColor: colors.ink },
  tickCur: { backgroundColor: colors.mark },

  strip: { gap: 10, paddingRight: 4 },
  stripItem: {
    width: 60, aspectRatio: 2 / 3, borderRadius: 3, overflow: "hidden",
    shadowColor: colors.ink, shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 5 }, shadowRadius: 10, elevation: 3,
  },
  stripCover: { width: "100%", height: "100%" },
  stripEmpty: {
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.ruleStrong,
    borderRadius: 2, paddingVertical: 14, alignItems: "center",
  },
  stripEmptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.pencil },

  scroll: { flex: 1 },
  content: { paddingBottom: 8 },

  // Hero header

  // Currently reading card

  // Stats

  // Want to read

  // Empty currently reading

  // Reading goal card


  // ── Profile panel ──────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,10,18,0.65)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    width: PANEL_W,
    height: "100%",
    flexDirection: "column",
    backgroundColor: colors.cream2,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 20,
    elevation: 20,
  },

  // Panel header (gradient section)
  panelHeader: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.rule,
    alignItems: "center",
    justifyContent: "center",
  },
  panelAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.rule,
    borderWidth: 2.5,
    borderColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  panelAvatarText: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
  },
  panelName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.espresso,
    marginBottom: 8,
    textAlign: "center",
  },
  panelBadge: {
    backgroundColor: colors.blushSoft,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  panelBadgeText: {
    fontSize: 11,
    color: colors.terra2,
    fontWeight: "600",
  },

  // Stats strip
  panelStats: {
    flexDirection: "row",
    backgroundColor: colors.parchment,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cream3,
    paddingVertical: 16,
  },
  panelStat: {
    flex: 1,
    alignItems: "center",
  },
  panelStatV: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.espresso,
  },
  panelStatL: {
    fontSize: 10,
    color: colors.char3,
    marginTop: 2,
  },
  panelStatDivider: {
    width: 1,
    backgroundColor: colors.cream3,
    marginVertical: 4,
  },

  // Menu rows
  panelMenu: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream3,
  },
  panelRowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  panelRowLabel: {
    fontSize: 14,
    color: colors.espresso,
    fontWeight: "500",
  },

  panelDivider: {
    height: 1,
    backgroundColor: colors.cream3,
    marginTop: 8,
    marginBottom: 8,
  },

  // Log out
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 40,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    borderRadius: 12,
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },

  // ── Edit Profile ────────────────────────────────────────────────────────
  editScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream3,
    backgroundColor: colors.parchment,
  },
  editBackBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    alignItems: "center", justifyContent: "center",
  },
  editTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.espresso,
  },

  editAvatarWrap: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
  },
  editAvatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.rule,
    borderWidth: 2.5, borderColor: colors.terracotta,
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  editAvatarText: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.espresso,
  },

  editForm: {
    paddingHorizontal: 20,
  },
  editField: {
    marginBottom: 22,
  },
  editLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.espresso2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  editLabelSub: {
    fontSize: 12,
    color: colors.char3,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: colors.parchment,
    borderWidth: 1.5,
    borderColor: colors.cream3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.espresso,
  },
  editInputFocused: {
    borderColor: colors.terracotta,
    backgroundColor: colors.blushSoft,
  },
  editBioInput: {
    height: 100,
    paddingTop: 13,
  },

  saveBtn: {
    backgroundColor: colors.terracotta,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
