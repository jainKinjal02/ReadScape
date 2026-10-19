import React, { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
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
  applyGoodreadsUpdates,
  parseGoodreadsExport,
  planImport,
} from "../src/lib/goodreads";
import {
  ConnectMessage,
  EXPORT_RELOAD_MS,
  EXPORT_SCRIPT,
  EXPORT_TIMEOUT_MS,
  ExportLink,
  GOODREADS_EXPORT_PAGE,
  GOODREADS_SIGN_IN_URL,
  PRESS_EXPORT,
  RELOAD_PAGE,
  downloadScript,
  isExportPage,
  isSignInPage,
  linkKey,
} from "../src/lib/goodreadsConnect";

type Phase =
  | "intro" // choose: connect Goodreads, or upload a file
  | "upload" // the by-hand instructions and file picker
  | "connect" // signing in to Goodreads in the in-app browser
  | "fetching" // signed in; Readscape is exporting and downloading
  | "stale" // Goodreads didn't produce a new export; offer the older one
  | "reading"
  | "preview"
  | "importing"
  | "done";

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
  const [updatedCount, setUpdatedCount] = useState(0);
  const [exportLabel, setExportLabel] = useState("");
  const [stale, setStale] = useState<ExportLink | null>(null);
  // Goodreads' pages can take a few seconds; show that something is happening.
  const [webLoading, setWebLoading] = useState(true);
  const webRef = useRef<WebView>(null);
  const sentToExport = useRef(false);
  // The export in progress, kept here rather than in the page (see
  // goodreadsConnect.ts): pressed when, which export was showing before,
  // when the page was last refreshed, and whether a download is under way.
  const exportRun = useRef<{ pressedAt: number; before: string | null; reloadedAt: number; downloading: boolean } | null>(null);

  const leave = () => {
    // Inside a step (signing in, uploading, the older-export choice), back
    // returns to the start of the import rather than leaving it.
    if (phase === "connect" || phase === "fetching" || phase === "stale" || phase === "upload") {
      setPhase("intro");
      return;
    }
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
      setExportLabel("");
      planFrom(text);
    } catch (e) {
      setError(
        e instanceof NotAGoodreadsExportError
          ? "That file doesn't look like a Goodreads export. Choose the file named goodreads_library_export.csv."
          : toUserMessage(e, "Couldn't read that file. Please try again.")
      );
      setPhase("upload");
    }
  };

  /** Parse an export (uploaded or fetched) and show what it would add. */
  const planFrom = (text: string) => {
    const books = parseGoodreadsExport(text);
    if (books.length === 0) throw new NotAGoodreadsExportError();
    setPlan(planImport(books, library));
    setPhase("preview");
  };

  // ── Connect Goodreads ─────────────────────────────────────────────────────
  const startConnect = () => {
    setError("");
    setStale(null);
    sentToExport.current = false;
    exportRun.current = null;
    setWebLoading(true);
    setPhase("connect");
  };

  // Once the reader is past the sign-in pages, go to the export page; the
  // script there does the rest.
  const onNavigate = (nav: WebViewNavigation) => {
    if (nav.loading) return;
    if (isExportPage(nav.url)) {
      setPhase((p) => (p === "connect" ? "fetching" : p));
      return;
    }
    if (!isSignInPage(nav.url) && !sentToExport.current) {
      sentToExport.current = true;
      setPhase("fetching");
      webRef.current?.injectJavaScript(`location.href = ${JSON.stringify(GOODREADS_EXPORT_PAGE)}; true;`);
    }
  };

  const failConnect = (message: string) => {
    setError(message);
    setPhase("intro");
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: ConnectMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "exportPage": {
        const run = exportRun.current;
        const now = Date.now();
        if (!run) {
          if (!msg.hasButton) {
            failConnect("Goodreads' export page didn't look the way we expected. You can upload the file instead.");
            return;
          }
          // Remember the export already showing (often an old one), then ask
          // Goodreads for a new one.
          exportRun.current = { pressedAt: now, before: linkKey(msg.link), reloadedAt: now, downloading: false };
          setPhase("fetching");
          webRef.current?.injectJavaScript(PRESS_EXPORT);
          return;
        }
        if (run.downloading) return;
        if (msg.link && linkKey(msg.link) !== run.before) {
          run.downloading = true;
          webRef.current?.injectJavaScript(downloadScript(msg.link));
          return;
        }
        if (now - run.pressedAt > EXPORT_TIMEOUT_MS) {
          if (msg.link) {
            run.downloading = true; // stop reacting while the reader chooses
            setStale(msg.link);
            setPhase("stale");
          } else {
            failConnect("Goodreads didn't produce an export. Try again in a few minutes, or upload the file instead.");
          }
          return;
        }
        // The finished export may only show after a refresh.
        if (now - run.reloadedAt > EXPORT_RELOAD_MS) {
          run.reloadedAt = now;
          webRef.current?.injectJavaScript(RELOAD_PAGE);
        }
        break;
      }
      case "csv":
        try {
          setExportLabel(msg.label.replace(/^your export from\s*/i, ""));
          planFrom(msg.text);
        } catch {
          failConnect("Goodreads sent something we couldn't read. Try again, or upload the file instead.");
        }
        break;
      case "error":
        failConnect("Couldn't download your library from Goodreads. Check your connection and try again.");
        break;
    }
  };

  const useStale = () => {
    if (!stale) return;
    setPhase("fetching");
    webRef.current?.injectJavaScript(downloadScript(stale));
  };

  const runImport = async () => {
    if (!plan || !userId) return;
    setPhase("importing");
    const total = plan.toAdd.length + plan.toUpdate.length;
    setProgress({ done: 0, total });
    try {
      const added = plan.toAdd.length
        ? await importGoodreadsBooks(userId, plan.toAdd, (done) => setProgress({ done, total }))
        : [];
      await applyGoodreadsUpdates(plan.toUpdate);
      setProgress({ done: total, total });
      setAddedCount(added.length);
      setUpdatedCount(plan.toUpdate.length);
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

      {/* The in-app browser: visible while signing in, then covered while
          the export runs. It stays mounted throughout so the session lasts. */}
      {(phase === "connect" || phase === "fetching" || phase === "stale") && (
        <View
          style={[StyleSheet.absoluteFill, { top: insets.top + 48 }, phase === "stale" && styles.hidden]}
          pointerEvents={phase === "stale" ? "none" : "auto"}
        >
          {phase === "connect" && (
            <Text style={styles.connectHint}>Sign in to Goodreads. We'll take it from there.</Text>
          )}
          <WebView
            ref={webRef}
            source={{ uri: GOODREADS_SIGN_IN_URL }}
            // Nothing from the Goodreads session is kept after this screen.
            incognito
            injectedJavaScript={EXPORT_SCRIPT}
            onNavigationStateChange={onNavigate}
            onLoadStart={() => setWebLoading(true)}
            onLoadEnd={() => setWebLoading(false)}
            onMessage={onMessage}
            onError={() => failConnect("Couldn't reach Goodreads. Check your connection and try again.")}
            style={{ flex: 1 }}
          />
          {phase === "connect" && webLoading && (
            <View style={[StyleSheet.absoluteFill, styles.webLoading]} pointerEvents="none">
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.webLoadingText}>Loading Goodreads…</Text>
            </View>
          )}
          {phase === "fetching" && (
            <View style={[StyleSheet.absoluteFill, styles.fetching, { paddingBottom: insets.top + 48 }]}>
              <ActivityIndicator color={colors.ink} />
              <Text style={[styles.title, styles.centerText]}>Bringing in your books…</Text>
              <Text style={[styles.lead, { textAlign: "center" }]}>
                Goodreads is preparing your library. Big libraries can take a minute; keep this screen open.
              </Text>
            </View>
          )}
        </View>
      )}

      {phase !== "connect" && phase !== "fetching" && (
      <ScrollView contentContainerStyle={[styles.body, { flexGrow: 1, paddingBottom: insets.bottom + 32 }]}>
        {phase === "intro" && (
          <>
            <Text style={styles.title}>Bring your books from Goodreads</Text>
            <Text style={styles.lead}>
              Sign in to Goodreads and we'll bring in your shelves, ratings, read dates and reviews.
            </Text>

            <TouchableOpacity style={styles.primary} onPress={startConnect} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Connect Goodreads</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghost} onPress={() => { setError(""); setPhase("upload"); }} activeOpacity={0.8}>
              <Text style={styles.ghostText}>Upload a file instead</Text>
            </TouchableOpacity>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.small}>
              You sign in on Goodreads' own page; Readscape never sees your password. We only read your
              library export, and you'll see what will be added before anything is saved.
            </Text>

            {fromOnboarding && (
              <TouchableOpacity onPress={leave} style={styles.notNow}>
                <Text style={styles.notNowText}>Not now</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {(phase === "upload" || phase === "reading") && (
          <>
            <Text style={styles.title}>Upload your export</Text>
            <Text style={styles.lead}>
              If you already have your Goodreads export file, or connecting didn't work.
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

        {phase === "stale" && stale && (
          <View style={styles.centerFill}>
            <Text style={[styles.title, styles.centerText]}>Use your latest export?</Text>
            <Text style={[styles.lead, styles.centerText]}>
              Goodreads didn't make a new export just now (it limits how often you can export). Your most
              recent one is from {stale.label.replace(/^your export from\s*/i, "")}, and won't include
              anything you've changed on Goodreads since.
            </Text>
            <TouchableOpacity style={[styles.primary, styles.wide]} onPress={useStale} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Use that export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ghost, styles.wide]} onPress={startConnect} activeOpacity={0.8}>
              <Text style={styles.ghostText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "preview" && plan && (
          <>
            {!!exportLabel && <Text style={styles.small}>Your Goodreads export from {exportLabel}</Text>}
            <Text style={styles.title}>
              {plan.toAdd.length > 0
                ? `${plan.toAdd.length} ${plan.toAdd.length === 1 ? "book" : "books"} to add`
                : plan.toUpdate.length > 0
                  ? `${plan.toUpdate.length} ${plan.toUpdate.length === 1 ? "change" : "changes"} from Goodreads`
                  : "You're up to date"}
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
            {plan.toUpdate.length > 0 && (
              <View style={styles.updates}>
                {plan.toAdd.length > 0 && (
                  <Text style={styles.updatesHead}>
                    And {plan.toUpdate.length} {plan.toUpdate.length === 1 ? "change" : "changes"} from Goodreads
                  </Text>
                )}
                {/* Every change, in full: nothing is applied that wasn't shown. */}
                {plan.toUpdate.map((u) => (
                  <View key={u.book.id} style={styles.updateRow}>
                    <Text style={styles.rowLabel} numberOfLines={2}>{u.book.title}</Text>
                    <Text style={styles.rowChange}>{u.describe.join(" · ")}</Text>
                  </View>
                ))}
              </View>
            )}
            {plan.alreadyInLibrary.length > 0 && (
              <Text style={styles.lead}>
                {plan.alreadyInLibrary.length} already in your library and unchanged.
              </Text>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            {plan.toAdd.length + plan.toUpdate.length > 0 ? (
              <TouchableOpacity style={styles.primary} onPress={runImport} activeOpacity={0.85}>
                <Text style={styles.primaryText}>
                  {plan.toAdd.length > 0 && plan.toUpdate.length > 0
                    ? `Import ${plan.toAdd.length} and update ${plan.toUpdate.length}`
                    : plan.toAdd.length > 0
                      ? `Import ${plan.toAdd.length} ${plan.toAdd.length === 1 ? "book" : "books"}`
                      : `Update ${plan.toUpdate.length} ${plan.toUpdate.length === 1 ? "book" : "books"}`}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={leave} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Done</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setPlan(null); setError(""); setPhase(exportLabel ? "intro" : "upload"); }} style={styles.notNow}>
              <Text style={styles.notNowText}>{exportLabel ? "Start over" : "Choose a different file"}</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === "importing" && (
          <View style={styles.centerFill}>
            <Text style={[styles.title, styles.centerText]}>Adding your books</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress.total ? Math.max(4, Math.round((progress.done / progress.total) * 100)) : 4}%` },
                ]}
              />
            </View>
            <Text style={[styles.lead, styles.centerText]}>
              {progress.done} of {progress.total}
            </Text>
          </View>
        )}

        {phase === "done" && (
          <View style={styles.centerFill}>
            <View style={styles.doneMark}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.title, styles.centerText]}>Welcome home</Text>
            <Text style={[styles.lead, styles.centerText]}>
              {[
                addedCount > 0 && `${addedCount} ${addedCount === 1 ? "book is" : "books are"} on your shelf.`,
                updatedCount > 0 && `${updatedCount} updated from Goodreads.`,
                addedCount > 0 && "Covers will fill in over the next few minutes.",
              ]
                .filter(Boolean)
                .join(" ")}
            </Text>
            <TouchableOpacity
              style={[styles.primary, styles.wide]}
              onPress={() => router.replace("/(tabs)/library")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>See my library</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      )}
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
  // Waiting and finished states sit in the middle of the screen.
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingBottom: 64 },
  centerText: { textAlign: "center" },
  wide: { alignSelf: "stretch" },
  progressTrack: {
    alignSelf: "stretch", height: 6, borderRadius: 3, backgroundColor: colors.rule,
    overflow: "hidden", marginTop: 4,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  doneMark: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mark,
    alignItems: "center", justifyContent: "center",
  },

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
  updates: { borderTopWidth: 1, borderTopColor: colors.rule },
  updatesHead: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, paddingTop: 14, paddingBottom: 4 },
  updateRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.rule, gap: 3 },
  rowChange: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.pencil },
  connectHint: {
    fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink,
    paddingHorizontal: 24, paddingBottom: 10,
  },
  webLoading: {
    backgroundColor: "rgba(251,250,246,0.82)", alignItems: "center", justifyContent: "center", gap: 12,
  },
  webLoadingText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  fetching: {
    backgroundColor: colors.paper, alignItems: "center", justifyContent: "center",
    gap: 14, paddingHorizontal: 32,
  },
  hidden: { opacity: 0 },
  notNowText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.pencil },
});
