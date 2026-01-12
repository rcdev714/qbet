import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export default function LoginScreen() {
  const { signIn, signUp } = useAuthContext();
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setAuthSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { user: newUser, error } = await signUp(email, password);
        if (error) throw error;

        if (!newUser) {
          Alert.alert(
            "Check your email",
            "We have sent you a verification email. Please click the link in the email to verify your account.",
            [{ text: "OK", onPress: () => setIsLogin(true) }]
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      Alert.alert("Error", errorMessage);
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.authContainer}>
        <View style={styles.authHeader}>
          <Text style={[styles.title, { color: theme.text }]}>Prediction Market</Text>
          <Text style={styles.subtitle}>
            {isLogin ? "Welcome back" : "Create your account"}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="Email address"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, authSubmitting && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={authSubmitting}
            activeOpacity={0.8}
          >
            {authSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? "Sign In" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={[styles.switchButtonText, { color: theme.textSecondary }]}>
              {isLogin
                ? "New here? Create account"
                : "Have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  authContainer: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
  },
  authHeader: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: "#8E8E93",
    fontWeight: "400",
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    color: "#1A1A1A",
  },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    height: 48,
    justifyContent: 'center',
    backgroundColor: '#007AFF', // Force Blue
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500", // Elegant weight
  },
  switchButton: {
    marginTop: 16,
    alignItems: "center",
    padding: 8,
  },
  switchButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
});

