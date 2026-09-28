import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fonts } from "../design/tokens";
import { toUserMessage } from "../lib/errors";
import { formatDuration, voiceNoteUrl } from "../lib/voice";

/**
 * Plays a voice note's recording. The bucket is private, so the signed URL is
 * fetched on first tap rather than for every note on screen.
 */
export function VoicePlayButton({ audioPath, durationMs }: { audioPath: string; durationMs?: number | null }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Back to the start once it has played through, so the next tap replays.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (!loaded) {
        setLoading(true);
        player.replace({ uri: await voiceNoteUrl(audioPath) });
        setLoaded(true);
      }
      player.play();
    } catch (e) {
      Alert.alert("Couldn't play this note", toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const total = durationMs ?? (status.duration ? status.duration * 1000 : 0);
  const shown = status.playing || status.currentTime > 0 ? status.currentTime * 1000 : total;

  return (
    <TouchableOpacity
      style={s.btn}
      onPress={toggle}
      activeOpacity={0.75}
      accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink} style={{ transform: [{ scale: 0.7 }] }} />
      ) : status.playing ? (
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Rect x={5} y={4} width={5} height={16} rx={1} fill={colors.ink} />
          <Rect x={14} y={4} width={5} height={16} rx={1} fill={colors.ink} />
        </Svg>
      ) : (
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d="M7 4.5v15l12.5-7.5z" fill={colors.ink} />
        </Svg>
      )}
      <Text style={s.time}>{total ? formatDuration(shown) : "voice note"}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start",
    backgroundColor: colors.rule, borderRadius: 2,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 9,
  },
  time: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.ink, fontVariant: ["tabular-nums"] },
});
