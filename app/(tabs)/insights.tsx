import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { colors } from "../../src/design/tokens";
import { STATS, LIBRARY_BOOKS } from "../../src/data/mockData";
import { useAppStore } from "../../src/store";
import {
  uploadGalleryPhoto,
  fetchGalleryPhotos,
  deleteGalleryPhoto,
  type PersistedPhoto,
} from "../../src/lib/gallery";

type GalleryPhoto = PersistedPhoto;

// Slight tilt per card — deterministic so it doesn't change on re-render
const TILTS = [-2.5, 1.4, -1.1, 2.6, -2, 1.8, -1.6, 2.2];

const { width: SW } = Dimensions.get("window");
// Card is 47% of (screen - 40px padding - 12px gap)
const CARD_W = (SW - 40 - 12) / 2;

const BG = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200&q=80";

const HEADER_IMGS = [
  "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80",
  "https://images.unsplash.com/photo-1476275466078-4cdc48d9e56f?w=800&q=80",
];

// ─── Genre configuration ─────────────────────────────────────────────────────
// Add a local `image` require() for each genre as you generate the images.
// Leave as `null` to fall back to the gradient.
const GENRES: {
  name: string;
  emoji: string;
  gradient: readonly [string, string];
  image: any;
}[] = [
  { name: "Fiction",    emoji: "📚", gradient: ["#7F77DD", "#4a40a8"], image: require("../../assets/genres/fiction.png") },
  { name: "Fantasy",    emoji: "🌟", gradient: ["#5bbfaa", "#2d8a78"], image: require("../../assets/genres/fantasy.png") },
  { name: "Sci-Fi",     emoji: "🚀", gradient: ["#3a7bd5", "#1a4898"], image: require("../../assets/genres/scifi.png") },
  { name: "Thriller",   emoji: "⚡", gradient: ["#8b3535", "#5a1010"], image: require("../../assets/genres/thriller.png") },
  { name: "Self-Help",  emoji: "🌱", gradient: ["#c47a4a", "#8a4020"], image: require("../../assets/genres/selfhelp.png") },
  { name: "Romance",    emoji: "🌸", gradient: ["#c06080", "#8a2850"], image: require("../../assets/genres/romance.png") },
  { name: "History",    emoji: "🏛️", gradient: ["#7a6a40", "#4a3a18"], image: require("../../assets/genres/history.png") },
  { name: "Biography",  emoji: "🖊️", gradient: ["#4a7090", "#254060"], image: require("../../assets/genres/biography.png") },
  { name: "Horror",     emoji: "🌙", gradient: ["#6a2a7a", "#2a0a3a"], image: require("../../assets/genres/horror.png") },
  { name: "Dystopian",  emoji: "🔮", gradient: ["#4a5078", "#222440"], image: require("../../assets/genres/dystopian.png") },
];

function bookCountForGenre(genre: string) {
  return LIBRARY_BOOKS.filter((b) => b.genre === genre).length;
}

// ─── Animated genre card ──────────────────────────────────────────────────────
function GenreCard({
  genre,
  index,
  onPress,
}: {
  genre: typeof GENRES[number];
  index: number;
  onPress: () => void;
}) {
  const count = bookCountForGenre(genre.name);

  // 1. Staggered entrance — fades + slides up
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceY = useRef(new Animated.Value(24)).current;

  // 2. Press spring scale
  const scale = useRef(new Animated.Value(1)).current;

  // 3. Shimmer sweep across the card
  const shimmerX = useRef(new Animated.Value(-CARD_W * 0.6)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 480,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(entranceY, {
        toValue: 0,
        duration: 420,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer loop — offset each card so they don't all flash at once
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2800 + index * 350),
        Animated.timing(shimmerX, {
          toValue: CARD_W * 1.4,
          duration: 750,
          useNativeDriver: true,
        }),
        // Reset instantly
        Animated.timing(shimmerX, {
          toValue: -CARD_W * 0.6,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: entranceOpacity,
          transform: [{ translateY: entranceY }, { scale }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Background: local image if available, else solid gradient */}
        {genre.image ? (
          <Image
            source={genre.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={genre.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Dark gradient overlay at bottom — keeps text legible over photos */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          locations={[0.3, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Shimmer beam — a narrow translucent band that sweeps left→right */}
        <Animated.View
          style={[styles.shimmerBeam, { transform: [{ translateX: shimmerX }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              "transparent",
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0.08)",
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* Card content */}
        <View style={styles.cardContent}>
          <Text style={styles.genreEmoji}>{genre.emoji}</Text>
          <Text style={styles.genreName}>{genre.name}</Text>
          <Text style={styles.genreCount}>
            {count > 0 ? `${count} book${count !== 1 ? "s" : ""}` : "Explore"}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Fan position config per slot ─────────────────────────────────────────────
const FAN_POS: Record<number, { rotate: number; tx: number; ty: number; scale: number }[]> = {
  1: [{ rotate: 0,   tx: 0,   ty: 0,  scale: 1    }],
  2: [{ rotate: -10, tx: -44, ty: 10, scale: 0.90 },
      { rotate:  10, tx:  44, ty: 10, scale: 0.90 }],
  3: [{ rotate: -15, tx: -58, ty: 18, scale: 0.83 },
      { rotate:   0, tx:   0, ty:  0, scale: 1    },
      { rotate:  15, tx:  58, ty: 18, scale: 0.83 }],
};
// JSX render order for each fan size so the center book appears on top
const FAN_RENDER_ORDER: Record<number, number[]> = { 1: [0], 2: [0, 1], 3: [0, 2, 1] };

// ─── Staggered timeline row ───────────────────────────────────────────────────
function StaggeredRow({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty      = useRef(new Animated.Value(22)).current;
  useEffect(() => {
    const delay = 480 + index * 90;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(ty,      { toValue: 0, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

// ─── Year Wrap Modal ──────────────────────────────────────────────────────────
function YearWrapModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const books = useAppStore((s) => s.books);
  const readingGoal = useAppStore((s) => s.readingGoal);
  const year = new Date().getFullYear();

  // Slide-up animation
  const slideY = useRef(new Animated.Value(600)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Compute wrap stats from real store data
  const finishedBooks = books.filter((b) => {
    if (b.status !== "read") return false;
    if (!b.date_finished) return true; // count books marked read even without date
    return new Date(b.date_finished).getFullYear() === year;
  });

  const totalPages = finishedBooks.reduce((sum, b) => sum + (b.total_pages ?? 0), 0);

  // Top genre
  const genreCounts: Record<string, number> = {};
  finishedBooks.forEach((b) => {
    (b.genre ?? []).forEach((g) => {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    });
  });
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const goalMet = readingGoal > 0 && finishedBooks.length >= readingGoal;

  // Cover fan — up to 3 books with a cover image
  const coverBooks = finishedBooks.filter((b) => !!b.cover_url).slice(0, 3);
  const fanCount = Math.min(coverBooks.length, 3) as 1 | 2 | 3;

  // One animated slot per fan position (always 3 slots, unused ones stay at opacity 0)
  const fanAnims = useRef(
    Array.from({ length: 3 }, () => ({
      rotate:  new Animated.Value(0),
      tx:      new Animated.Value(0),
      ty:      new Animated.Value(50),
      scale:   new Animated.Value(0.55),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (visible && fanCount > 0) {
      const positions = FAN_POS[fanCount];
      Animated.parallel(
        fanAnims.slice(0, fanCount).flatMap((anim, i) => {
          const p = positions[i];
          return [
            Animated.spring(anim.rotate, { toValue: p.rotate, useNativeDriver: true, speed: 11, bounciness: 7 }),
            Animated.spring(anim.tx,     { toValue: p.tx,     useNativeDriver: true, speed: 11, bounciness: 5 }),
            Animated.spring(anim.ty,     { toValue: p.ty,     useNativeDriver: true, speed: 11, bounciness: 5 }),
            Animated.spring(anim.scale,  { toValue: p.scale,  useNativeDriver: true, speed: 11, bounciness: 5 }),
            Animated.timing(anim.opacity, { toValue: 1, duration: 300, delay: i * 60, useNativeDriver: true }),
          ];
        })
      ).start();
    } else {
      fanAnims.forEach((anim) => {
        anim.rotate.setValue(0);
        anim.tx.setValue(0);
        anim.ty.setValue(50);
        anim.scale.setValue(0.55);
        anim.opacity.setValue(0);
      });
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[wrapStyles.overlay, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[wrapStyles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] }]}
      >
        {/* Header gradient */}
        <LinearGradient
          colors={["rgba(127,119,221,0.35)", "rgba(127,119,221,0.08)", "transparent"]}
          style={wrapStyles.sheetGrad}
          pointerEvents="none"
        />

        {/* Stars decoration */}
        <View style={wrapStyles.starsRow} pointerEvents="none">
          {["✦", "✧", "✦", "✧", "✦"].map((s, i) => (
            <Text key={i} style={[wrapStyles.star, { opacity: 0.4 + i * 0.08 }]}>{s}</Text>
          ))}
        </View>

        {/* Close pill */}
        <TouchableOpacity style={wrapStyles.closeArea} onPress={onClose}>
          <View style={wrapStyles.closePill} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={wrapStyles.scrollContent}>
          {/* Year label */}
          <Text style={wrapStyles.yearLabel}>{year}</Text>
          <Text style={wrapStyles.wrapHeading}>Your Reading Year</Text>

          {/* Animated cover fan */}
          {fanCount > 0 && (
            <View style={wrapStyles.fanContainer}>
              {(FAN_RENDER_ORDER[fanCount] ?? []).map((coverIdx) => {
                const anim = fanAnims[coverIdx];
                const book = coverBooks[coverIdx];
                if (!book) return null;
                return (
                  <Animated.View
                    key={book.id}
                    style={[
                      wrapStyles.fanCard,
                      {
                        opacity: anim.opacity,
                        transform: [
                          { translateX: anim.tx },
                          { translateY: anim.ty },
                          {
                            rotate: anim.rotate.interpolate({
                              inputRange: [-20, 20],
                              outputRange: ["-20deg", "20deg"],
                            }),
                          },
                          { scale: anim.scale },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: book.cover_url! }}
                      style={wrapStyles.fanCoverImg}
                      contentFit="cover"
                    />
                  </Animated.View>
                );
              })}
            </View>
          )}

          {finishedBooks.length === 0 ? (
            /* Empty state */
            <View style={wrapStyles.emptyState}>
              <Text style={wrapStyles.emptyEmoji}>📖</Text>
              <Text style={wrapStyles.emptyTitle}>Your story starts here</Text>
              <Text style={wrapStyles.emptySub}>
                Finish your first book of {year} and it'll appear in your wrap.
              </Text>
            </View>
          ) : (
            <>
              {/* Big stat cards */}
              <View style={wrapStyles.statRow}>
                <View style={wrapStyles.statCard}>
                  <Text style={wrapStyles.statBig}>{finishedBooks.length}</Text>
                  <Text style={wrapStyles.statLabel}>Books finished</Text>
                  {readingGoal > 0 && (
                    <Text style={[wrapStyles.statNote, goalMet && { color: colors.sage }]}>
                      {goalMet ? `Goal of ${readingGoal} reached ✓` : `${readingGoal - finishedBooks.length} left to goal`}
                    </Text>
                  )}
                </View>
                <View style={wrapStyles.statCard}>
                  <Text style={wrapStyles.statBig}>{totalPages > 0 ? totalPages.toLocaleString() : "—"}</Text>
                  <Text style={wrapStyles.statLabel}>Pages turned</Text>
                  {totalPages > 0 && (
                    <Text style={wrapStyles.statNote}>{Math.round(totalPages / 365)} pages/day avg</Text>
                  )}
                </View>
              </View>

              {/* Top genre badge */}
              {topGenre && (
                <View style={wrapStyles.genreBadge}>
                  <Text style={wrapStyles.genreBadgeLabel}>Your top genre</Text>
                  <Text style={wrapStyles.genreBadgeValue}>{topGenre}</Text>
                </View>
              )}

              {/* Books timeline */}
              <Text style={wrapStyles.timelineTitle}>Books you finished</Text>
              {finishedBooks.map((book, idx) => (
                <StaggeredRow key={book.id} index={idx}>
                  <View style={wrapStyles.timelineRow}>
                    <View style={wrapStyles.timelineLeft}>
                      <Text style={wrapStyles.timelineNum}>{String(idx + 1).padStart(2, "0")}</Text>
                      {idx < finishedBooks.length - 1 && <View style={wrapStyles.timelineLine} />}
                    </View>
                    <View style={wrapStyles.timelineCard}>
                      {book.cover_url ? (
                        <Image
                          source={{ uri: book.cover_url }}
                          style={wrapStyles.timelineCover}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[wrapStyles.timelineCover, wrapStyles.timelineCoverFallback]}>
                          <Text style={{ fontSize: 18 }}>📚</Text>
                        </View>
                      )}
                      <View style={wrapStyles.timelineInfo}>
                        <Text style={wrapStyles.timelineBookTitle} numberOfLines={2}>{book.title}</Text>
                        {book.author ? (
                          <Text style={wrapStyles.timelineAuthor} numberOfLines={1}>{book.author}</Text>
                        ) : null}
                        {book.rating ? (
                          <Text style={wrapStyles.timelineRating}>
                            {"★".repeat(book.rating)}{"☆".repeat(5 - (book.rating ?? 0))}
                          </Text>
                        ) : null}
                        {book.date_finished ? (
                          <Text style={wrapStyles.timelineDate}>
                            {new Date(book.date_finished).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </StaggeredRow>
              ))}
            </>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const readingGoal = useAppStore((s) => s.readingGoal);
  const [showWrap, setShowWrap] = useState(false);

  // ── Gallery state ─────────────────────────────────────────────────────────
  const userId = useAppStore((s) => s.userId);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [captionInput, setCaptionInput] = useState("");
  const [showCaptionSheet, setShowCaptionSheet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<GalleryPhoto | null>(null);

  // Fetch persisted photos whenever the user is known
  useEffect(() => {
    if (!userId) return;
    setPhotosLoading(true);
    fetchGalleryPhotos(userId)
      .then(setPhotos)
      .catch((e) => console.warn("[Gallery] fetch error:", e))
      .finally(() => setPhotosLoading(false));
  }, [userId]);

  // Open the source picker overlay (not a Modal — no UIViewController conflict)
  const handleAddPhoto = () => setShowSourcePicker(true);

  const pickPhoto = async (source: "camera" | "library") => {
    // Hide the overlay first, then give React one tick to remove it before
    // the native picker presents — avoids any stacking issues
    setShowSourcePicker(false);
    await new Promise((r) => setTimeout(r, 180));
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        console.log("[Gallery] Requesting camera permission...");
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        console.log("[Gallery] Camera permission status:", perm.status);
        if (perm.status !== "granted") {
          Alert.alert("Camera access needed", "Allow camera access in Settings to take photos.");
          return;
        }
        console.log("[Gallery] Launching camera...");
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 5],
        });
      } else {
        console.log("[Gallery] Requesting media library permission...");
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log("[Gallery] Media library permission status:", perm.status);
        if (perm.status !== "granted" && perm.status !== "limited") {
          Alert.alert("Photos access needed", "Allow photo library access in Settings.");
          return;
        }
        console.log("[Gallery] Launching image library...");
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 5],
        });
      }
      console.log("[Gallery] Picker result — canceled:", result.canceled, "assets:", result.assets?.length);
      if (!result.canceled && result.assets[0]) {
        console.log("[Gallery] Photo selected, URI:", result.assets[0].uri);
        setPendingUri(result.assets[0].uri);
        setCaptionInput("");
        setShowCaptionSheet(true);
      }
    } catch (e) {
      console.error("[Gallery] Error opening picker:", e);
      Alert.alert("Couldn't open " + (source === "camera" ? "camera" : "photos"));
    }
  };

  const savePhoto = async () => {
    if (!pendingUri || !userId) return;
    setIsSaving(true);
    try {
      const photo = await uploadGalleryPhoto(userId, pendingUri, captionInput.trim());
      setPhotos((prev) => [photo, ...prev]);
      setPendingUri(null);
      setCaptionInput("");
      setShowCaptionSheet(false);
    } catch (e: any) {
      console.error("[Gallery] upload error:", e);
      Alert.alert(
        "Couldn't save photo",
        e?.message ?? "Check your connection and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deletePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    Alert.alert("Delete photo?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          // Optimistic update — remove from UI immediately
          setPhotos((p) => p.filter((ph) => ph.id !== id));
          setViewingPhoto(null);
          try {
            await deleteGalleryPhoto(photo.id, photo.storagePath);
          } catch (e: any) {
            console.error("[Gallery] delete error:", e);
            // Restore the photo if the server delete failed
            setPhotos((p) => [photo, ...p]);
            Alert.alert("Couldn't delete", e?.message ?? "Try again.");
          }
        },
      },
    ]);
  };

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

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={{ uri: BG }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,35,0.7)" }]} />

      {/* ── Atmospheric hero header ── */}
      <View style={styles.heroHeader}>
        {HEADER_IMGS.map((src, i) => (
          <Animated.View key={src} style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}>
            <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        ))}
        <LinearGradient
          colors={["rgba(44,31,20,0.55)", "rgba(44,31,20,0.35)", colors.cream]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.heroTitle}>Reading Insights</Text>
          <Text style={styles.heroSub}>Your {new Date().getFullYear()} journey</Text>
        </View>
      </View>

      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["bottom"]}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

          <View style={styles.body}>
            {/* Stats 2×2 */}
            <View style={styles.bigStatRow}>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.booksRead}</Text>
                <Text style={styles.bigStatL}>Books finished</Text>
                <Text style={styles.bigStatS}>
                  {readingGoal > 0 ? `Goal: ${readingGoal} books` : "Set a goal"}
                </Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>2,847</Text>
                <Text style={styles.bigStatL}>Pages read</Text>
                <Text style={styles.bigStatS}>Avg 34 min/day</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.streak}</Text>
                <Text style={styles.bigStatL}>Day streak</Text>
                <Text style={styles.bigStatS}>Best: 23 days</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.quotesSaved}</Text>
                <Text style={styles.bigStatL}>Quotes saved</Text>
                <Text style={styles.bigStatS}>Across all books</Text>
              </View>
            </View>

            {/* Genre section header */}
            <View style={styles.secHdr}>
              <Text style={styles.secTitle}>Explore by genre</Text>
            </View>

            {/* Genre grid */}
            <View style={styles.genreGrid}>
              {GENRES.map((g, i) => (
                <GenreCard
                  key={g.name}
                  genre={g}
                  index={i}
                  onPress={() => router.push(`/genre/${g.name}`)}
                />
              ))}
            </View>

            {/* ── My Cozy Corner Gallery ── */}
            <View style={styles.secHdrRow}>
              <Text style={styles.secTitle}>My Cozy Corner</Text>
              <TouchableOpacity style={styles.cameraBtn} onPress={() => handleAddPhoto()}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={colors.espresso} strokeWidth={1.5} strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={4} stroke={colors.espresso} strokeWidth={1.5} />
                </Svg>
                <Text style={styles.cameraBtnText}>Add photo</Text>
              </TouchableOpacity>
            </View>

            {photosLoading ? (
              <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.char3, fontSize: 12 }}>Loading photos…</Text>
              </View>
            ) : photos.length === 0 ? (
              /* Empty state */
              <TouchableOpacity style={styles.galleryEmpty} activeOpacity={0.8} onPress={() => handleAddPhoto()}>
                <LinearGradient
                  colors={["rgba(127,119,221,0.08)", "rgba(127,119,221,0.04)"]}
                  style={StyleSheet.absoluteFill}
                />
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={colors.char3} strokeWidth={1.4} strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={4} stroke={colors.char3} strokeWidth={1.4} />
                </Svg>
                <Text style={styles.galleryEmptyTitle}>Capture your reading moments</Text>
                <Text style={styles.galleryEmptySub}>Book hauls, cosy corners, reading nooks — your story.</Text>
                <View style={styles.galleryEmptyBtn}>
                  <Text style={styles.galleryEmptyBtnText}>Take a photo</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryStrip}
              >
                {photos.map((photo, idx) => (
                  <TouchableOpacity
                    key={photo.id}
                    style={[styles.polaroid, { transform: [{ rotate: `${TILTS[idx % TILTS.length]}deg` }] }]}
                    onPress={() => setViewingPhoto(photo)}
                    activeOpacity={0.88}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.polaroidImg}
                      contentFit="cover"
                      transition={400}
                      placeholder={{ color: "#ede8df" }}
                    />
                    <Text style={styles.polaroidCaption} numberOfLines={1}>
                      {photo.caption || new Date(photo.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Add more tile */}
                <TouchableOpacity
                  style={[styles.polaroidAdd, { transform: [{ rotate: `${TILTS[photos.length % TILTS.length]}deg` }] }]}
                  onPress={() => handleAddPhoto()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.polaroidAddPlus}>+</Text>
                  <Text style={styles.polaroidAddLabel}>Add more</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Year wrap CTA */}
            <TouchableOpacity style={styles.wrapCTA} activeOpacity={0.85} onPress={() => setShowWrap(true)}>
              <Text style={styles.wrapTitle}>Your {new Date().getFullYear()} reading wrap</Text>
              <Text style={styles.wrapSub}>{STATS.booksRead} books · your year in one page</Text>
              <View style={styles.wrapBtn}>
                <Text style={styles.wrapBtnText}>View wrap</Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <YearWrapModal visible={showWrap} onClose={() => setShowWrap(false)} />

      {/* ── Source picker overlay (absolute, NOT a Modal — no UIViewController conflict) ── */}
      {showSourcePicker && (
        <View style={galStyles.sourceOverlayWrap} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSourcePicker(false)} />
          <View style={[galStyles.sourceSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={galStyles.sheetPill} />
            <Text style={galStyles.sheetHeading}>Add a photo</Text>
            <TouchableOpacity style={galStyles.sourceRow} onPress={() => pickPhoto("camera")}>
              <View style={galStyles.sourceIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={colors.terracotta} strokeWidth={1.5} strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={4} stroke={colors.terracotta} strokeWidth={1.5} />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={galStyles.sourceLabel}>Take a Photo</Text>
                <Text style={galStyles.sourceSub}>Use your camera</Text>
              </View>
              <Text style={galStyles.sourceArrow}>›</Text>
            </TouchableOpacity>
            <View style={galStyles.sourceDivider} />
            <TouchableOpacity style={galStyles.sourceRow} onPress={() => pickPhoto("library")}>
              <View style={galStyles.sourceIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={3} width={18} height={18} rx={3} stroke={colors.terracotta} strokeWidth={1.5} />
                  <Path d="M3 16l5-5 4 4 3-3 6 6" stroke={colors.terracotta} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={8.5} cy={8.5} r={1.5} fill={colors.terracotta} />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={galStyles.sourceLabel}>Choose from Library</Text>
                <Text style={galStyles.sourceSub}>Your photo library</Text>
              </View>
              <Text style={galStyles.sourceArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={galStyles.cancelBtn} onPress={() => setShowSourcePicker(false)}>
              <Text style={galStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Caption sheet ────────────────────────────────────────────────────── */}
      <Modal transparent visible={showCaptionSheet} animationType="slide" onRequestClose={() => setShowCaptionSheet(false)}>
        {/*
          KAV is a column. The backdrop TouchableOpacity takes flex:1 (all space
          above the sheet). When the keyboard opens, KAV adds bottom padding equal
          to the keyboard height — shrinking the column — which pushes the sheet up.
          This works because the sheet is a normal flow child, NOT absolutely positioned.
        */}
        <KeyboardAvoidingView
          style={galStyles.captionKAV}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCaptionSheet(false)} />
          <View style={[galStyles.captionSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={galStyles.sheetPill} />
            {pendingUri && (
              <Image source={{ uri: pendingUri }} style={galStyles.previewImg} contentFit="cover" />
            )}
            <TextInput
              style={galStyles.captionInput}
              value={captionInput}
              onChangeText={setCaptionInput}
              placeholder="Add a caption (optional)…"
              placeholderTextColor={colors.char3}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={savePhoto}
            />
            <View style={galStyles.captionActions}>
              <TouchableOpacity style={galStyles.skipBtn} onPress={savePhoto} disabled={isSaving}>
                <Text style={galStyles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[galStyles.saveBtn, isSaving && { opacity: 0.6 }]}
                onPress={savePhoto}
                disabled={isSaving}
              >
                {isSaving
                  ? <Text style={galStyles.saveBtnText}>Saving…</Text>
                  : <Text style={galStyles.saveBtnText}>Post to Gallery</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Full-screen photo viewer ─────────────────────────────────────────── */}
      <Modal transparent visible={!!viewingPhoto} animationType="fade" onRequestClose={() => setViewingPhoto(null)}>
        <View style={galStyles.viewer}>
          <StatusBar barStyle="light-content" />

          {/* Close — top right */}
          <TouchableOpacity
            style={[galStyles.viewerClose, { top: insets.top + 12 }]}
            onPress={() => setViewingPhoto(null)}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          {/* Image — fills remaining space */}
          {viewingPhoto && (
            <Image
              source={{ uri: viewingPhoto.uri }}
              style={galStyles.viewerImg}
              transition={300}
              placeholder={{ color: "#1a1a2e" }}
              contentFit="contain"
            />
          )}

          {/* Bottom bar — gradient fade, literary caption */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
            locations={[0, 0.35, 1]}
            style={[galStyles.viewerBottom, { paddingBottom: insets.bottom + 24 }]}
          >
            {viewingPhoto?.caption ? (
              <View style={galStyles.captionBlock}>
                <View style={galStyles.captionRule} />
                <Text style={galStyles.viewerCaption}>{viewingPhoto.caption}</Text>
              </View>
            ) : null}
            {viewingPhoto && (
              <TouchableOpacity
                style={galStyles.viewerDeleteBtn}
                onPress={() => deletePhoto(viewingPhoto.id)}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ff6b6b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={galStyles.viewerDeleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Atmospheric hero header
  heroHeader: { height: 170, overflow: "hidden", justifyContent: "flex-end" },
  heroContent: { paddingHorizontal: 20, paddingBottom: 16 },
  heroTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#faf6f0" },
  heroSub: { fontSize: 13, color: "rgba(247,242,235,0.75)", marginTop: 3 },

  body: { paddingTop: 16 },

  // Stats
  bigStatRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  bigStat: {
    width: "47%",
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: 14,
    padding: 16,
  },
  bigStatV: { fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: colors.espresso },
  bigStatL: { fontSize: 11, color: colors.char3, marginTop: 2 },
  bigStatS: { fontSize: 11, color: colors.terracotta, marginTop: 4, fontWeight: "500" },

  secHdr: { paddingHorizontal: 20, marginBottom: 14 },
  secHdrRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 14,
  },
  secTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: colors.espresso },
  secSub: { fontSize: 12, color: colors.char3, marginTop: 3 },

  cameraBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12,
  },
  cameraBtnText: { fontSize: 11, color: colors.espresso, fontWeight: "500" },

  // Gallery empty state
  galleryEmpty: {
    marginHorizontal: 20, marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(127,119,221,0.2)", borderRadius: 18,
    alignItems: "center", padding: 32, gap: 10, overflow: "hidden",
  },
  galleryEmptyTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: colors.espresso, textAlign: "center" },
  galleryEmptySub: { fontSize: 12, color: colors.char3, textAlign: "center", lineHeight: 18 },
  galleryEmptyBtn: {
    marginTop: 6, backgroundColor: colors.terracotta,
    borderRadius: 16, paddingVertical: 9, paddingHorizontal: 22,
  },
  galleryEmptyBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },

  // Polaroid strip
  galleryStrip: { paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  polaroid: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 8,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  polaroidImg: { width: 148, height: 148, borderRadius: 2 },
  polaroidCaption: { fontFamily: "CormorantGaramond_700Bold", fontSize: 11, color: "#444", marginTop: 6, textAlign: "center" },
  polaroidAdd: {
    width: 164,
    height: 192,
    backgroundColor: colors.cream2,
    borderWidth: 1.5, borderColor: "rgba(127,119,221,0.35)", borderStyle: "dashed",
    borderRadius: 4,
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  polaroidAddPlus: { fontSize: 28, color: colors.terracotta },
  polaroidAddLabel: { fontSize: 11, color: colors.terracotta },

  // Genre grid
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  // Card
  cardWrapper: {
    width: CARD_W,
    aspectRatio: 0.92,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  cardTouchable: {
    flex: 1,
  },
  shimmerBeam: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: CARD_W * 0.55,   // beam is ~55% of card width
    left: 0,
  },
  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  genreEmoji: { fontSize: 34, marginBottom: 8 },
  genreName: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 16,
    color: "#ffffff",
    marginBottom: 3,
  },
  genreCount: {
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },

  // Year wrap CTA button
  wrapCTA: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "rgba(127,119,221,0.1)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.25)",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  wrapTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: colors.espresso, marginBottom: 4 },
  wrapSub: { fontSize: 12, color: colors.char3 },
  wrapBtn: {
    marginTop: 10,
    backgroundColor: colors.espresso,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  wrapBtnText: { color: colors.cream, fontSize: 12, fontWeight: "500" },
});

// ─── Year Wrap Modal styles ───────────────────────────────────────────────────
const wrapStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    backgroundColor: colors.parchment,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetGrad: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    paddingTop: 28,
    paddingBottom: 4,
  },
  star: { fontSize: 10, color: colors.terracotta },
  closeArea: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 12 },
  closePill: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.cream3 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },

  // Book cover fan
  fanContainer: {
    height: 168,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  fanCard: {
    position: "absolute",
    width: 76,
    height: 110,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  fanCoverImg: { width: "100%", height: "100%" },

  yearLabel: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 56,
    color: colors.terracotta,
    opacity: 0.22,
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 6,
  },
  wrapHeading: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 26,
    color: colors.espresso,
    textAlign: "center",
    marginTop: -34,
    marginBottom: 24,
  },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: colors.espresso, marginBottom: 8 },
  emptySub: { fontSize: 13, color: colors.char3, textAlign: "center", lineHeight: 20 },

  // Stats row
  statRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.cream2,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statBig: { fontFamily: "CormorantGaramond_700Bold", fontSize: 36, color: colors.espresso },
  statLabel: { fontSize: 11, color: colors.char3, marginTop: 2, textAlign: "center" },
  statNote: { fontSize: 10, color: colors.terracotta, marginTop: 6, textAlign: "center", fontWeight: "500" },

  // Top genre badge
  genreBadge: {
    backgroundColor: "rgba(127,119,221,0.12)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  genreBadgeLabel: { fontSize: 11, color: colors.char3, marginBottom: 4, letterSpacing: 0.5 },
  genreBadgeValue: { fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: colors.terracotta },

  // Books timeline
  timelineTitle: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 17,
    color: colors.espresso,
    marginBottom: 16,
  },
  timelineRow: { flexDirection: "row", marginBottom: 20 },
  timelineLeft: { width: 32, alignItems: "center" },
  timelineNum: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 13,
    color: colors.terracotta,
    opacity: 0.7,
    marginBottom: 6,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.cream3,
    marginBottom: 4,
  },
  timelineCard: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.cream2,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: 12,
    padding: 12,
    marginLeft: 10,
  },
  timelineCover: {
    width: 48,
    height: 68,
    borderRadius: 6,
    flexShrink: 0,
  },
  timelineCoverFallback: {
    backgroundColor: colors.cream3,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineInfo: { flex: 1, justifyContent: "center" },
  timelineBookTitle: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 15,
    color: colors.espresso,
    lineHeight: 20,
  },
  timelineAuthor: { fontSize: 11, color: colors.char3, marginTop: 3 },
  timelineRating: { fontSize: 11, color: colors.terracotta, marginTop: 4 },
  timelineDate: { fontSize: 10, color: colors.char3, marginTop: 4, opacity: 0.7 },
});

// ─── Gallery styles ───────────────────────────────────────────────────────────
const galStyles = StyleSheet.create({
  // Source picker — absolute overlay, no Modal, dark themed
  sourceOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 100,
  },
  sourceSheet: {
    backgroundColor: colors.parchment,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingTop: 12, paddingHorizontal: 20,
    shadowColor: "#000", shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: -4 }, shadowRadius: 20,
    elevation: 20,
  },
  sheetPill: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.cream3, alignSelf: "center", marginBottom: 18,
  },
  sheetHeading: {
    fontFamily: "CormorantGaramond_700Bold", fontSize: 20,
    color: colors.espresso, marginBottom: 8,
  },
  sourceRow: {
    flexDirection: "row", alignItems: "center",
    gap: 14, paddingVertical: 16,
  },
  sourceIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "rgba(127,119,221,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  sourceLabel: { fontSize: 15, color: colors.espresso, fontWeight: "600" },
  sourceSub: { fontSize: 12, color: colors.char3, marginTop: 2 },
  sourceArrow: { fontSize: 20, color: colors.char3, opacity: 0.6 },
  sourceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cream3 },
  cancelBtn: {
    marginTop: 10, backgroundColor: colors.cream2,
    borderRadius: 16, paddingVertical: 15, alignItems: "center",
  },
  cancelText: { fontSize: 14, color: colors.char3, fontWeight: "500" },

  // Caption sheet
  captionKAV: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  captionSheet: {
    // No position:absolute — must be a normal flow child so KAV can push it up
    backgroundColor: colors.parchment,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, alignItems: "center",
  },
  previewImg: { width: 110, height: 110, borderRadius: 10, marginBottom: 14 },
  captionInput: {
    width: "100%",
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: colors.espresso, marginBottom: 14,
  },
  captionActions: { flexDirection: "row", gap: 10, width: "100%" },
  skipBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, paddingVertical: 13, alignItems: "center",
  },
  skipText: { fontSize: 14, color: colors.char3 },
  saveBtn: {
    flex: 2, backgroundColor: colors.terracotta,
    borderRadius: 14, paddingVertical: 13, alignItems: "center",
  },
  saveBtnText: { fontSize: 14, color: "#fff", fontWeight: "600" },

  // Photo viewer — flex layout, nothing overlapping
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerImg: { flex: 1, width: "100%" },
  viewerClose: {
    position: "absolute", right: 16, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  viewerBottom: {
    paddingTop: 48, paddingHorizontal: 32,
    alignItems: "center", gap: 18,
  },
  captionBlock: { alignItems: "center", gap: 10, width: "100%" },
  captionRule: {
    width: 36, height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  viewerCaption: {
    fontFamily: "CormorantGaramond_400Regular_Italic",
    color: "rgba(255,255,255,0.92)",
    fontSize: 19, textAlign: "center", lineHeight: 27,
    letterSpacing: 0.3,
  },
  viewerDeleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingVertical: 8, paddingHorizontal: 18,
    backgroundColor: "rgba(255,107,107,0.1)",
    borderWidth: 1, borderColor: "rgba(255,107,107,0.3)",
    borderRadius: 22,
  },
  viewerDeleteText: { color: "#ff6b6b", fontSize: 13, fontWeight: "500" },
});
