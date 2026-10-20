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
  Linking,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, moodConfig } from "../../src/design/tokens";
import { toUserMessage } from "../../src/lib/errors";
import { CoverImage } from "../../src/components/CoverImage";
import { useAppStore } from "../../src/store";
import { useBooks } from "../../src/hooks/useBooks";
import { fetchMoodLogs } from "../../src/lib/books";
import { useReadingStreak } from "../../src/hooks/useReadingStreak";
import { Book } from "../../src/types";
import { supabase } from "../../src/lib/supabase";
import { deleteAccount, OAuthCancelledError } from "../../src/lib/auth";
import { Avatar } from "../../src/components/Avatar";
import { useTabBarSpace } from "../../src/components/FloatingTabBar";
import { SOCIALS, SocialKind, socialUrl } from "../../src/lib/profile";
import { SocialIcon } from "../../src/components/SocialIcons";
import { openSocial } from "../../src/lib/profile";

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
  const profile = useAppStore((s) => s.profile);
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);
  const { width: winW } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  // Reference gutter is 23px on a 352px frame (~6.5%). Scale it, then clamp so
  // it never crowds a small phone or drifts wide on a tablet or browser.
  const gutter = Math.round(Math.min(30, Math.max(18, winW * 0.065)));

  // The book you are actually reading is the point of this screen, so its
  // cover leads. At 70pt it sat only 10pt clear of the 60pt strip covers
  // further down and read as just another thumbnail.
  const nowCoverW = Math.round(Math.min(112, Math.max(84, winW * 0.245)));

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

  // ── Delete account ────────────────────────────────────────────────────────
  // Required by App Store guideline 5.1.1(v). The panel is a Modal, and iOS
  // can block network requests started inside one, so it closes first.
  const [deletingAccount, setDeletingAccount] = useState(false);

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, your library, notes, quotes, photos and voice notes. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            closePanel(async () => {
              setDeletingAccount(true);
              try {
                await deleteAccount();
                setUserId(null);
                setUserName("");
                router.replace("/");
              } catch (e) {
                // Backing out of the Apple confirmation is a choice, not an error.
                if (e instanceof OAuthCancelledError) return;
                Alert.alert("Couldn't delete your account", toUserMessage(e));
              } finally {
                setDeletingAccount(false);
              }
            }),
        },
      ]
    );
  };

  // Edit Profile is its own screen (app/edit-profile.tsx).
  const openEditProfile = () => closePanel(() => router.push("/edit-profile"));

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

  // TikTok and Instagram first: they are the ones readers mostly share.
  const socialLinks = (["tiktok", "instagram", "twitter", "goodreads"] as SocialKind[])
    .map((kind) => ({
      kind,
      label: SOCIALS.find((x) => x.kind === kind)!.label,
      url: socialUrl(kind, profile.socials[kind]),
    }))
    .filter((l): l is { kind: SocialKind; label: string; url: string } => !!l.url);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: gutter, paddingTop: insets.top + 12, paddingBottom: tabSpace },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The reader: photo, name, pronouns and bio, and their links ── */}
        <View style={styles.profile}>
          <Avatar name={userName || "Reader"} uri={profile.avatarUrl} size={64} />
          <View style={styles.profileText}>
            <Text style={styles.name} numberOfLines={1}>{userName || "Reader"}</Text>
            {(!!profile.pronouns || !!profile.bio) && (
              <Text style={styles.bioLine} numberOfLines={2}>
                {!!profile.pronouns && <Text style={styles.pronouns}>{profile.pronouns}</Text>}
                {!!profile.pronouns && !!profile.bio ? "  •  " : ""}
                {profile.bio}
              </Text>
            )}
            {socialLinks.length > 0 && (
              <View style={styles.socialRow}>
                {socialLinks.map((l) => (
                  <TouchableOpacity
                    key={l.kind}
                    accessibilityLabel={l.label}
                    style={styles.socialBtn}
                    onPress={() => openSocial(l.kind, profile.socials[l.kind])}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    activeOpacity={0.75}
                  >
                    <SocialIcon kind={l.kind} color={colors.ink} size={16} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          {/* The menu: initials, as before. Profile editing lives in there. */}
          <TouchableOpacity
            testID="profile-avatar"
            accessibilityLabel="Menu"
            onPress={openPanel}
            activeOpacity={0.7}
            style={styles.menuBtn}
          >
            <Avatar name={userName || "Reader"} uri={null} size={36} />
          </TouchableOpacity>
        </View>

        <View style={styles.ruleStrong} />

        {/* ── Now reading ── */}
        {current ? (
          <TouchableOpacity
            style={styles.now}
            activeOpacity={0.85}
            onPress={() => router.push(`/book/${current.id}`)}
          >
            <View style={[styles.nowCover, { width: nowCoverW }]}>
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
            <Avatar name={userName || "Reader"} uri={profile.avatarUrl} size={72} style={{ marginBottom: 12 }} />
            <Text style={styles.panelName}>{userName || "Reader"}</Text>
            <TouchableOpacity style={styles.panelEdit} onPress={openEditProfile} activeOpacity={0.8}>
              <Text style={styles.panelEditText}>Edit profile</Text>
            </TouchableOpacity>
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
            <PanelRow icon="📚" label="My Library" onPress={() => closePanel(() => router.push("/(tabs)/library"))} />
            <PanelRow icon="✒️" label="Notes" onPress={() => closePanel(() => router.push("/(tabs)/notes"))} />
            <PanelRow icon="📊" label="Insights" onPress={() => closePanel(() => router.push("/(tabs)/insights"))} />
            <PanelRow icon="📥" label="Import from Goodreads" onPress={() => closePanel(() => router.push("/import-goodreads"))} />
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

          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={confirmDeleteAccount}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteAccountText}>Delete account</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>


      {deletingAccount && (
        <View style={styles.deletingOverlay}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.deletingText}>Deleting your account…</Text>
        </View>
      )}
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
  // The reader, in one row: photo, name and bio, menu
  profile: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingBottom: 18 },
  profileText: { flex: 1 },
  name: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: colors.ink,
    marginTop: 2,
  },
  bioLine: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink, marginTop: 3 },
  pronouns: { fontFamily: fonts.bodyMedium, color: colors.ink },
  socialRow: { flexDirection: "row", gap: 8, marginTop: 9 },
  socialBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: colors.ruleStrong,
    alignItems: "center", justifyContent: "center",
  },
  menuBtn: { marginTop: 2 },

  // A heavier rule than the hairlines below it — this is the masthead break.
  ruleStrong: { borderTopWidth: 1.5, borderTopColor: colors.ink },
  divide: { borderTopWidth: 1, borderTopColor: colors.rule, marginTop: 19, paddingTop: 18 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
  h2: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  xs: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil },

  now: { flexDirection: "row", gap: 16, paddingTop: 18 },
  nowCover: {
    aspectRatio: 2 / 3, borderRadius: 3, overflow: "hidden",
    // A heavier shadow than the strips below: this one is lifted off the page.
    shadowColor: colors.ink, shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 9 }, shadowRadius: 18, elevation: 6,
  },
  nowCoverImg: { width: "100%", height: "100%" },
  nowBody: { flex: 1, minWidth: 0 },
  nowTitle: { fontFamily: fonts.display, fontSize: 17.5, lineHeight: 21, color: colors.ink },
  nowAuthor: { fontFamily: fonts.body, fontSize: 12.5, color: colors.pencil, marginTop: 4 },
  prog: { height: 2, backgroundColor: colors.rule, marginTop: 15 },
  progFill: { height: 2, backgroundColor: colors.ink },
  nowMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil, marginTop: 9 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 11 },
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
  panelName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.espresso,
    marginBottom: 8,
    textAlign: "center",
  },
  panelEdit: {
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  panelEditText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },

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
    marginBottom: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    borderRadius: 12,
    justifyContent: "center",
  },
  deleteAccountBtn: { alignSelf: "center", paddingVertical: 10, marginBottom: 28 },
  deleteAccountText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.pencil },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(251,250,246,0.92)",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  deletingText: { fontFamily: fonts.body, fontSize: 13, color: colors.pencil },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },

});
