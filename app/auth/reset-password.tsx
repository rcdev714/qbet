import React, { useState } from "react";
import { Alert, Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";
import { authService } from "@/services/auth.service";

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await authService.updatePassword(password);
    setLoading(false);

    if (error) {
      Alert.alert("Could not reset password", error.message);
      return;
    }

    Alert.alert("Password updated", "You can now sign in with your new password.");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Set a new password</Text>
        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          Choose a strong password for your Anymarkt account.
        </Text>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="New password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="Confirm password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <AppButton title="Update password" onPress={handleSubmit} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, maxWidth: 480, alignSelf: "center", width: "100%" },
  title: { fontSize: 22, fontWeight: "400", marginBottom: 8, letterSpacing: -0.2 },
  helper: { fontSize: 14, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
  },
});
