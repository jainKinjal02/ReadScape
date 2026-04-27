import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";

// Prefetch every background used across tabs so images are in memory
// before the user first visits each screen — eliminates the load flash.
const BG_URLS = [
  "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=1200&q=80",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80",
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200&q=80",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1200&q=80",
];

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}
function LibraryIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}
function InsightsIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function AIIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

// Icon wrapper — just the SVG + optional focused dot.
// Label is rendered by tabBarLabel (full tab width, never clipped).
function TabIcon({ icon, focused }: { icon: React.ReactNode; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      {icon}
      {focused && <View style={styles.dot} />}
    </View>
  );
}

// Label rendered in its own full-width slot — can never be cut off.
function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[styles.label, { color }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  useEffect(() => {
    BG_URLS.forEach((url) => Image.prefetch(url));
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.terracotta,
        tabBarInactiveTintColor: colors.char3,
        tabBarIndicatorStyle: { height: 0, backgroundColor: "transparent" },
        lazy: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: ({ color }) => <TabLabel label="Home" color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={<HomeIcon color={color} />} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarLabel: ({ color }) => <TabLabel label="Library" color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={<LibraryIcon color={color} />} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarLabel: ({ color }) => <TabLabel label="Insights" color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={<InsightsIcon color={color} />} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarLabel: ({ color }) => <TabLabel label="Ask" color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={<AIIcon color={color} />} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.parchment,
    borderTopColor: colors.cream3,
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 82 : 62,
    paddingBottom: Platform.OS === "ios" ? 22 : 6,
    paddingTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.terracotta,
    marginTop: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
  },
});
