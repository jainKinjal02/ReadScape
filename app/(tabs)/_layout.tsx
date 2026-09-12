import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../src/design/tokens";

// Text only, no icons. The current tab is marked the way you would mark a
// line in a book — a highlighter swipe, set very slightly off-square so it
// reads as drawn rather than printed.
function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.labelWrap}>
      {focused && <View style={styles.mark} />}
      <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, {
          height: 52 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        }],
        tabBarShowLabel: true,
        // No icons at all, so the icon slot must not reserve vertical space.
        tabBarIconStyle: { display: "none" },
        lazy: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Library" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Insights" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Ask" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.paper,
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    paddingTop: 0,
    // Paper does not float above the page, so no drop shadow.
    elevation: 0,
    shadowOpacity: 0,
  },
  labelWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  mark: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 2,
    bottom: -1,
    backgroundColor: colors.mark,
    borderRadius: 2,
    transform: [{ rotate: "-0.8deg" }],
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.pencil2,
    textAlign: "center",
  },
  labelActive: { color: colors.ink },
});
