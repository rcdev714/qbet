import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { AppScreen } from "@/components/ui/AppScreen";
import { AppText } from "@/components/ui/AppText";
import { getPublicEnv } from "@/lib/public-env";

export default function EmailUnsubscribePage() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing unsubscribe token.");
      return;
    }

    const supabaseUrl = getPublicEnv().supabaseUrl.replace(/\/$/, "");
    const url = `${supabaseUrl}/functions/v1/email-unsubscribe?token=${encodeURIComponent(String(token))}`;
    setTargetUrl(url);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.replace(url);
    }
  }, [token]);

  if (error) {
    return (
      <AppScreen>
        <AppText>{error}</AppText>
      </AppScreen>
    );
  }

  if (!targetUrl) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </AppScreen>
    );
  }

  if (Platform.OS !== "web") {
    return (
      <AppScreen scroll={false}>
        <WebView source={{ uri: targetUrl }} style={styles.webview} startInLoadingState />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.center}>
        <ActivityIndicator />
        <AppText color="secondary" style={styles.redirectHint}>
          Redirecting…
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  webview: { flex: 1 },
  redirectHint: { marginTop: 8 },
});
