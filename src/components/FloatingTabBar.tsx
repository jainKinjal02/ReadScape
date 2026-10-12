import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fonts } from "../design/tokens";

/** Height of the floating bar, without the gap below it. */
export const TAB_BAR_HEIGHT = 64;

/**
 * Space a tab screen leaves at the bottom of its scroll content so the last
 * item can scroll clear of the floating bar.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 20;
}

type IconProps = { color: string };

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  home: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 01-1 1h-5v-6h-5v6h-5a1 1 0 01-1-1v-9.5z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  ),
  library: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 011-1z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  ),
  insights: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={12} width={3.5} height={8} rx={1} stroke={color} strokeWidth={1.7} />
      <Rect x={10.25} y={7} width={3.5} height={13} rx={1} stroke={color} strokeWidth={1.7} />
      <Rect x={16.5} y={3.5} width={3.5} height={16.5} rx={1} stroke={color} strokeWidth={1.7} />
    </Svg>
  ),
  notes: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 4.5l5 5L9 20H4v-5L14.5 4.5z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M12.5 6.5l5 5" stroke={color} strokeWidth={1.7} />
    </Svg>
  ),
};

const LABELS: Record<string, string> = {
  home: "Home",
  library: "Library",
  insights: "Insights",
  notes: "Notes",
};

/**
 * A rounded, frosted bar that floats over the page, so content scrolls on
 * behind it. The current tab sits in a highlighter-yellow pill, the same mark
 * the app uses for emphasis everywhere else.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.shadow}>
        <BlurView intensity={40} tint="light" style={styles.bar}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const Icon = ICONS[route.name];
            const color = focused ? colors.ink : colors.pencil;

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={LABELS[route.name] ?? route.name}
                onPress={onPress}
                style={[styles.item, focused && styles.itemOn]}
              >
                {Icon && <Icon color={color} />}
                <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>
                  {LABELS[route.name] ?? route.name}
                </Text>
              </Pressable>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  shadow: {
    borderRadius: TAB_BAR_HEIGHT / 2,
    shadowColor: "#1B1A22",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    // Frosted, with enough paper underneath to stay legible over covers.
    backgroundColor: "rgba(251,250,246,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ruleStrong,
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT - 12,
    borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  itemOn: { backgroundColor: colors.mark },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.pencil },
  labelOn: { color: colors.ink, fontFamily: fonts.bodySemi },
});
