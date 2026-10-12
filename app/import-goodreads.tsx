import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../src/design/tokens";
import { toUserMessage } from "../src/lib/errors";
import { useAppStore } from "../src/store";
import { fetchUserBooks } from "../src/lib/books";
import {
  GOODREADS_EXPORT_URL,
  GoodreadsBook,
  ImportPlan,
  NotAGoodreadsExportError,
  importGoodreadsBooks,
  parseGoodreadsExport,
  planImport,
} from "../src/lib/goodreads";

type Phase = "intro" | "reading" | "preview" | "importing" | "done";

/**
 * Bring a Goodreads library into ReadScape from Goodreads' CSV export.
 *
 * Shown once after onboarding (?from=onboarding, with "Not now") and from the
 * profile menu and the empty library. Nothing is saved until the reader has
 * seen what will be added and confirmed it.
 */
export default function ImportGoodreadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = from === "onboarding";

  const userId = useAppStore((s) => s.userId);
  const library = useAppStore((s) => s.books);
  const setBooks = useAppStore((s) => s.setBooks);

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [addedCount, setAddedCount] = useState(0);

  const leave = () => {
    if (fromOnboarding) router.replace("/(tabs)/home");
    else router.back();
  };

  const chooseFile = async () => {
    setError("");
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text", "*/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setPhase("reading");
    try {
      const text = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const books = parseGoodreadsExport(text);
      if (books.length === 0) throw new NotAGoodreadsExportError();
      setPlan(planImport(books, library));
      setPhase("preview");
    } catch (e) {
      setError(
        e instanceof NotAGoodreadsExportError
          ? "That file doesn't look like a Goodreads export. Choose the file named goodreads_library_export.csv."
          : toUserMessage(e, "Couldn't read that file. Please try again.")
      );
      setPhase("intro");
    }
  };

  const runImport = async () => {
    if (!plan || !userId) return;
    setPhase("importing");
    setProgress({ done: 0, total: plan.toAdd.length });
    try {
      const added = await importGoodreadsBooks(userId, plan.toAdd, (done, total) =>
        setProgress({ done, total })
      );
      setAddedCount(added.length);
      // Reload rather than splice in: the shelf order comes from the server.
      setBooks(await fetchUserBooks(userId));
      setPhase("done");
    } catch (e) {
      // Batches that already landed stay; re-running skips them as duplicates.
      setBooks(await fetchUserBooks(userId).catch(() => library));
      setError(toUserMessage(e, "The import stopped part-way. Try again; books already added won't be duplicated."));
      setPhase("preview");
    }
  };

  const counts = (list: GoodreadsBook[]) => ({
    read: list.filter((b) => b.status === "read").length,
    reading: list.filter((b) => b.status === "reading").length,
    want: list.filter((b) => b.status === "want_to_read").length,
    putDown: list.filter((b) => b.status === "abandoned").length,
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        {phase !== "importing" && (
          <TouchableOpacity testID="import-back" onPress={leave} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        {(phase === "intro" || phase === "reading") && (
          <>
            <Text style={styles.title}>Bring your books from Goodreads</Text>
            <Text style={styles.lead}>
              Your shelves, ratings, read dates and reviews come with you. It takes about a minute.
            </Text>

            <View style={styles.steps}>
              <Step n={1} text="Open Goodreads' export page and sign in." />
              <Step n={2} text={'Tap "Export Library". When it\'s ready, download the file.'} />
              <Step n={3} text="Come back here and choose that file." />
            </View>

            <TouchableOpacity
              style={styles.ghost}
              onPress={() => WebBrowser.openBrowserAsync(GOODREADS_EXPORT_URL)}
              activeOpacity={0.8}
            >
              <Text style={styles.ghostText}>Open Goodreads export page</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primary, phase === "reading" && { opacity: 0.6 }]}
              onPress={chooseFile}
              disabled={phase === "reading"}
              activeOpacity={0.85}
            >
              {phase === "reading" ? (
                <ActivityIndicator color={colors.paper} />
              ) : (
                <Text style={styles.primaryText}>Choose the file</Text>
              )}
            </TouchableOpacity>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.small}>
              Goodreads' app can't export, so use their website. On a computer, you can send the file to this phone with AirDrop or iCloud Drive.
            </Text>

            {fromOnboarding && (
              <TouchableOpacity onPress={leave} style={styles.notNow}>
                <Text style={styles.notNowText}>Not now</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {phase === "preview" && plan && (
          <>
            <Text style={styles.title}>
              {plan.toAdd.length === 0 ? "You're up to date" : `${plan.toAdd.length} books to add`}
            </Text>
            {plan.toAdd.length > 0 && (
              <View style={styles.summary}>
                {(() => {
                  const c = counts(plan.toAdd);
                  return (
                    <>
                      <Row label="Read" value={c.read} />
                      <Row label="Reading" value={c.reading} />
                      <Row label="Want to read" value={c.want} />
                      {c.putDown > 0 && <Row label="Put down" value={c.putDown} />}
                    </>
                  );
                })()}
              </View>
            )}
            {plan.alreadyInLibrary.length > 0 && (
              <Text style={styles.lead}>
                {plan.alreadyInLibrary.length} already in your library will be left as they are.
              </Text>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            {plan.toAdd.length > 0 ? (
              <TouchableOpacity style={styles.primary} onPress={runImport} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Import {plan.toAdd.length} books</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={leave} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Done</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setPlan(null); setError(""); setPhase("intro"); }} style={styles.notNow}>
              <Text style={styles.notNowText}>Choose a different file</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === "importing" && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.lead}>
              Adding your books… {progress.done} of {progress.total}
            </Text>
          </View>
        )}

        {phase === "done" && (
          <>
            <Text style={styles.title}>Welcome home</Text>
            <Text style={styles.lead}>
              {addedCount} books are on your shelf. Covers will fill in over the next few minutes.
            </Text>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => router.replace("/(tabs)/library")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>See my library</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepN}>{n}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  top: { height: 32, paddingHorizontal: 24, justifyContent: "center" },
  body: { paddingHorizontal: 28, paddingTop: 24, gap: 16 },
  center: { alignItems: "center", gap: 16, paddingTop: 80 },

  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, lineHeight: 34 },
  lead: { fontFamily: fonts.body, fontSize: 15, color: colors.pencil, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.pencil2, lineHeight: 18 },
  error: { fontFamily: fonts.body, fontSize: 13.5, color: colors.danger, lineHeight: 19 },

  steps: { gap: 12, marginVertical: 6 },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepN: {
    fontFamily: fonts.bodySemi, fontSize: 12, color: colors.ink, width: 22, height: 22,
    lineHeight: 22, textAlign: "center", borderRadius: 11, backgroundColor: colors.rule, overflow: "hidden",
  },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, color: colors.ink, lineHeight: 21 },

  summary: { borderTopWidth: 1, borderTopColor: colors.rule },
  row: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  rowValue: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },

  primary: { backgroundColor: colors.ink, borderRadius: 3, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.paper },
  ghost: {
    borderWidth: 1, borderColor: colors.ruleStrong, borderRadius: 3,
    paddingVertical: 14, alignItems: "center", marginTop: 6,
  },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.ink },
  notNow: { alignSelf: "center", paddingVertical: 10 },
  notNowText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.pencil },
});
