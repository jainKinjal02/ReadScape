import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../src/design/tokens";
import { toUserMessage } from "../src/lib/errors";
import { supabase } from "../src/lib/supabase";
import { useAppStore } from "../src/store";
import { Avatar } from "../src/components/Avatar";
import {
  SOCIALS,
  SocialKind,
  Socials,
  deleteAvatarByUrl,
  profileFromMeta,
  uploadAvatar,
} from "../src/lib/profile";

/**
 * Edit Profile: photo, name, pronouns, goal, bio and social links.
 *
 * A screen of its own rather than a Modal on Home: iOS refuses to present the
 * photo picker over a presented Modal (it fails silently after the first
 * time), and a full screen also covers the floating tab bar.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAppStore((s) => s.userId);
  const userName = useAppStore((s) => s.userName);
  const readingGoal = useAppStore((s) => s.readingGoal);
  const profile = useAppStore((s) => s.profile);
  const setUserName = useAppStore((s) => s.setUserName);
  const setReadingGoal = useAppStore((s) => s.setReadingGoal);
  const setProfile = useAppStore((s) => s.setProfile);

  const [name, setName] = useState(userName);
  const [pronouns, setPronouns] = useState(profile.pronouns);
  const [goal, setGoal] = useState(readingGoal > 0 ? String(readingGoal) : "");
  const [bio, setBio] = useState(profile.bio);
  const [socials, setSocials] = useState<Socials>(profile.socials);
  // A newly picked photo (local file) waits here until Save; "" means removed.
  const [photo, setPhoto] = useState<string | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const shownPhoto = photo === null ? profile.avatarUrl : photo || null;

  const pickPhoto = async (source: "camera" | "library") => {
    setShowPhotoSheet(false);
    // Let the sheet finish closing before the system picker slides up.
    await new Promise((r) => setTimeout(r, 200));
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    const limited =
      "accessPrivileges" in perm && (perm as { accessPrivileges?: string }).accessPrivileges === "limited";
    if (!perm.granted && !limited) {
      Alert.alert(
        source === "camera" ? "Camera is off" : "Photos are off",
        "Allow access in Settings to choose a profile photo."
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true, // the system crop, square
      aspect: [1, 1],
      quality: 0.9,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    if (!userId) return;
    setSaving(true);
    try {
      let avatarUrl = profile.avatarUrl;
      if (photo) avatarUrl = (await uploadAvatar(userId, photo)).url;
      else if (photo === "") avatarUrl = null;

      const cleanSocials = Object.fromEntries(
        Object.entries(socials).map(([k, v]) => [k, v.trim()])
      ) as Socials;

      const { data, error } = await supabase.auth.updateUser({
        data: {
          name: name.trim(),
          reading_goal: Number(goal) || 0,
          bio: bio.trim(),
          pronouns: pronouns.trim(),
          avatar_url: avatarUrl,
          socials: cleanSocials,
        },
      });
      if (error) throw error;

      // The old photo is only removed once the new one is saved.
      if (avatarUrl !== profile.avatarUrl) await deleteAvatarByUrl(profile.avatarUrl).catch(() => {});

      setUserName(name.trim());
      setReadingGoal(Number(goal) || 0);
      setProfile(profileFromMeta(data.user?.user_metadata));
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save", toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string) => [styles.input, focused === key && styles.inputFocused];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity testID="edit-profile-back" style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 5l-7 7 7 7" stroke={colors.espresso2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <View style={styles.avatarWrap}>
            <TouchableOpacity onPress={() => setShowPhotoSheet(true)} activeOpacity={0.8}>
              <Avatar name={name || userName} uri={shownPhoto} size={96} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPhotoSheet(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.changePhoto}>Change profile photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>YOUR NAME</Text>
            <TextInput
              style={field("name")}
              value={name}
              onChangeText={setName}
              placeholder="Your display name"
              placeholderTextColor={colors.char3}
              autoCapitalize="words"
              onFocus={() => setFocused("name")}
              onBlur={() => setFocused(null)}
            />

            <Text style={styles.label}>PRONOUNS</Text>
            <TextInput
              style={field("pronouns")}
              value={pronouns}
              onChangeText={setPronouns}
              placeholder="e.g. she/her, he/him, they/them"
              placeholderTextColor={colors.char3}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              onFocus={() => setFocused("pronouns")}
              onBlur={() => setFocused(null)}
            />

            <Text style={styles.label}>READING GOAL</Text>
            <Text style={styles.sub}>How many books do you want to read this year?</Text>
            <TextInput
              style={field("goal")}
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. 20"
              placeholderTextColor={colors.char3}
              keyboardType="number-pad"
              onFocus={() => setFocused("goal")}
              onBlur={() => setFocused(null)}
            />

            <Text style={styles.label}>BIO</Text>
            <Text style={styles.sub}>A short note about your reading taste</Text>
            <TextInput
              style={[...field("bio"), styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="e.g. Lover of quiet fiction and late-night thrillers…"
              placeholderTextColor={colors.char3}
              multiline
              maxLength={200}
              textAlignVertical="top"
              onFocus={() => setFocused("bio")}
              onBlur={() => setFocused(null)}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>SOCIAL</Text>
            <Text style={styles.sub}>Shown on your profile so other readers can find you</Text>
            {SOCIALS.map(({ kind, label, placeholder }) => (
              <View key={kind} style={styles.socialRow}>
                <Text style={styles.socialLabel}>{label}</Text>
                <TextInput
                  testID={`social-${kind}`}
                  style={[...field(kind), styles.socialInput]}
                  value={socials[kind]}
                  onChangeText={(v) => setSocials((s) => ({ ...s, [kind as SocialKind]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={colors.char3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={kind === "goodreads" ? "url" : "default"}
                  onFocus={() => setFocused(kind)}
                  onBlur={() => setFocused(null)}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.65 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Photo source sheet: an overlay, not a Modal, for the picker's sake. */}
      {showPhotoSheet && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowPhotoSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.pill} />
            <Text style={styles.sheetTitle}>Profile photo</Text>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => pickPhoto("library")}>
              <Text style={styles.sheetBtnText}>Choose from library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => pickPhoto("camera")}>
              <Text style={styles.sheetBtnText}>Take a photo</Text>
            </TouchableOpacity>
            {!!shownPhoto && (
              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={() => {
                  setPhoto("");
                  setShowPhotoSheet(false);
                }}
              >
                <Text style={[styles.sheetBtnText, { color: colors.danger }]}>Remove photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.cream3, backgroundColor: colors.parchment,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3, alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.espresso },

  avatarWrap: { alignItems: "center", paddingTop: 28, paddingBottom: 24, gap: 12 },
  changePhoto: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.terracotta },

  form: { paddingHorizontal: 20 },
  label: {
    fontSize: 11, fontWeight: "700", color: colors.espresso2,
    letterSpacing: 0.8, marginBottom: 4, marginTop: 18,
  },
  sub: { fontSize: 12, color: colors.char3, marginBottom: 8 },
  input: {
    backgroundColor: colors.parchment, borderWidth: 1.5, borderColor: colors.cream3,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.espresso,
  },
  inputFocused: { borderColor: colors.terracotta, backgroundColor: colors.blushSoft },
  bioInput: { height: 100, paddingTop: 13 },

  socialRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  socialLabel: { width: 92, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  socialInput: { flex: 1, paddingVertical: 11 },

  saveBtn: {
    backgroundColor: colors.terracotta, borderRadius: 14, paddingVertical: 15,
    alignItems: "center", marginTop: 28,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },

  backdrop: { flex: 1, backgroundColor: "rgba(27,26,34,0.35)" },
  sheet: {
    backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, gap: 10,
  },
  pill: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.rule, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 4 },
  sheetBtn: {
    backgroundColor: colors.rule, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  sheetBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.ink },
});
