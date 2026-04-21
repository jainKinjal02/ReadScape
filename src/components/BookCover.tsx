import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { colors } from "../design/tokens";

interface Props {
  uri: string | null;
  title?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}

export function BookCover({
  uri,
  title,
  width = 100,
  height = 150,
  borderRadius = 8,
}: Props) {
  if (!uri) {
    return (
      <View
        style={{
          width,
          height,
          borderRadius,
          backgroundColor: colors.bgSurface,
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
        }}
      >
        <Text
          style={{
            color: colors.inkMuted,
            fontSize: 11,
            textAlign: "center",
            fontFamily: "CormorantGaramond_400Regular_Italic",
          }}
          numberOfLines={4}
        >
          {title ?? "No cover"}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius }}
      contentFit="cover"
      transition={200}
    />
  );
}
