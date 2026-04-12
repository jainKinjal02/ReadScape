import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { Mood } from "../types";
import { moodConfig } from "../design/tokens";

interface Props {
  mood: Mood;
  selected?: boolean;
  onPress?: () => void;
  size?: "sm" | "md";
}

export function MoodChip({ mood, selected = false, onPress, size = "md" }: Props) {
  const config = moodConfig[mood];
  const isSmall = size === "sm";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: isSmall ? 4 : 8,
        paddingHorizontal: isSmall ? 10 : 14,
        borderRadius: 999,
        backgroundColor: selected ? config.color + "30" : "#EDEAE4",
        borderWidth: 1.5,
        borderColor: selected ? config.color : "transparent",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: isSmall ? 14 : 18, marginRight: 4 }}>
        {config.emoji}
      </Text>
      <Text
        style={{
          fontSize: isSmall ? 12 : 13,
          color: selected ? config.color : "#2D2D2D",
          fontWeight: selected ? "600" : "400",
        }}
      >
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}
