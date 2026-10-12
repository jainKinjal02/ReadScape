import React from "react";
import { Tabs } from "expo-router";
import { colors } from "../../src/design/tokens";
import { FloatingTabBar } from "../../src/components/FloatingTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      // The bar floats over the page (it is absolutely positioned), so each
      // screen runs full height and its content scrolls on behind the bar.
      // Screens pad their scroll content with useTabBarSpace().
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Paint the scene itself, so a screen that forgets a root background
        // does not fall through to React Navigation's default white.
        sceneStyle: { backgroundColor: colors.paper },
        lazy: false,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="notes" />
    </Tabs>
  );
}
