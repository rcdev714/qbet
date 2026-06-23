import { Stack } from "expo-router";
import React from "react";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="groups" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
