import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "../../src/design/tokens";

const C = { active: colors.terracotta, inactive: colors.char3 };

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
function SessionIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path d="M12 7v5l3 3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
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

function TabIcon({
  icon,
  label,
  focused,
}: {
  icon: React.ReactNode;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabIcon}>
      {icon}
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      {focused && <View style={styles.dot} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<HomeIcon color={focused ? C.active : C.inactive} />}
              label="Home"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<LibraryIcon color={focused ? C.active : C.inactive} />}
              label="Library"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<SessionIcon color={focused ? C.active : C.inactive} />}
              label="Session"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<InsightsIcon color={focused ? C.active : C.inactive} />}
              label="Insights"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<AIIcon color={focused ? C.active : C.inactive} />}
              label="AI Chat"
              focused={focused}
            />
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
    // height accounts for content + bottom safe area on iOS
    height: Platform.OS === "ios" ? 84 : 64,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
    // Subtle shadow so the bar lifts off content
    shadowColor: "#2c1f14",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },
  tabBarItem: {
    paddingTop: 0,
    paddingBottom: 0,
    // Each tab fills its slot with comfortable horizontal padding
    paddingHorizontal: 4,
  },
  tabIcon: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: { fontSize: 10, fontWeight: "500", color: colors.char3, lineHeight: 13 },
  labelFocused: { color: colors.terracotta, fontWeight: "600" },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.terracotta,
    marginTop: 2,
  },
});
