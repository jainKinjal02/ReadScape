import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../src/design/tokens";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.bgSurface,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
        },
        tabBarActiveTintColor: colors.roseAccent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📚" label="Library" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="✨" label="Ask AI" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Insights" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: "center", paddingTop: 4 },
  emoji: { fontSize: 22 },
  label: { fontSize: 10, color: colors.inkMuted, marginTop: 2 },
  labelFocused: { color: colors.roseAccent, fontWeight: "600" },
});
