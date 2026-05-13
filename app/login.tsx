import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useAuthContext } from "../contexts/AuthContext";



export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuthContext();
  const params = useLocalSearchParams();
  // const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  // Default to sign up if mode is 'signup', otherwise login
  const [isLogin, setIsLogin] = useState(params.mode !== 'signup');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter your email and password to continue.");
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        Alert.alert("Check password", "Both password fields need to match.");
        return;
      }
      if (!acceptedAgreement) {
        Alert.alert("Agreement required", "Accept the Terms and Privacy Policy to create your account.");
        return;
      }
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
      let errorMessage = "An error occurred. Please try again.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        const errObj = error as { status?: number; statusText?: string; message?: string };
        if (errObj.status === 502 || errObj.status === 503) {
          errorMessage = "Service temporarily unavailable. Please wait a moment and try again.";
        } else if (errObj.message) {
          errorMessage = errObj.message;
        } else if (errObj.statusText) {
          errorMessage = errObj.statusText;
        }
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => Alert.alert("Error", "Couldn't load page"));
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/auth-bg.jpg")}
        style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
        contentFit="cover"
        transition={500}
      />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.backgroundOverlay} />
        <View style={styles.authContainer}>
          <View style={styles.authCard}>
            <View style={styles.authHeader}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/images/icon.svg")}
                  style={styles.logo}
                  contentFit="contain"
                />
                <Text style={styles.brandName}>AnyMarket</Text>
              </View>
              <Text style={styles.subtitle}>
                {isLogin ? "Welcome back" : "Create your account"}
              </Text>
              {!isLogin && (
                <Text style={styles.helperText}>
                  Start with practice credits and keep real-money wallet actions separate.
                </Text>
              )}
            </View>

            <View style={styles.form}>
              {Platform.OS === 'web' && (
                <View style={styles.googleSection}>
                  <TouchableOpacity
                    style={[styles.googleButton, authSubmitting && styles.buttonDisabled, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                    onPress={async () => {
                      setAuthSubmitting(true);
                      const { error } = await signInWithGoogle();
                      if (error) {
                        Alert.alert("Error", error.message);
                        setAuthSubmitting(false);
                      }
                      // If no error, we are redirecting, so don't stop loading
                    }}
                    disabled={authSubmitting}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-google" size={20} color="#16243F" style={{ marginRight: 10 }} />
                    <Text style={styles.googleButtonText}>
                      {isLogin ? "Continue with Google" : "Create account with Google"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or continue with email</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>
              )}

              <TextInput
                style={[styles.input, Platform.OS === 'web' && { cursor: 'text' } as any]}
                placeholder="Email"
                placeholderTextColor="rgba(219, 231, 255, 0.55)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={[styles.input, Platform.OS === 'web' && { cursor: 'text' } as any]}
                placeholder="Password"
                placeholderTextColor="rgba(219, 231, 255, 0.55)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {!isLogin && (
                <>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { cursor: 'text' } as any]}
                    placeholder="Confirm password"
                    placeholderTextColor="rgba(219, 231, 255, 0.55)"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[styles.agreementContainer, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                    onPress={() => setAcceptedAgreement(!acceptedAgreement)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.checkbox, acceptedAgreement && styles.checkboxChecked]}>
                      {acceptedAgreement && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I accept the <Text style={styles.linkText} onPress={(e) => { e.stopPropagation(); openLink("https://anymarket.netlify.app/terms"); }}>Terms of Service</Text> and <Text style={styles.linkText} onPress={(e) => { e.stopPropagation(); openLink("https://anymarket.netlify.app/privacy"); }}>Privacy Policy</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.button, authSubmitting && styles.buttonDisabled, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                onPress={handleAuth}
                disabled={authSubmitting}
                activeOpacity={0.85}
              >
                {authSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isLogin ? "Sign in" : "Create account"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.switchButton, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                onPress={() => {
                  setIsLogin(!isLogin);
                  setConfirmPassword("");
                }}
              >
                <Text style={styles.switchButtonText}>
                  {isLogin
                    ? "New here? Create account"
                    : "Have an account? Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9, 17, 30, 0.62)",
  },
  authContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  authCard: {
    width: "100%",
    maxWidth: 500,
    borderRadius: 28,
    padding: 24,
    backgroundColor: "rgba(15, 25, 43, 0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    ...Platform.select({
      web: {
        boxShadow: "0px 28px 56px rgba(3, 8, 19, 0.35)",
        backdropFilter: "blur(8px)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      },
    }),
  },
  authHeader: {
    marginBottom: 22,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandName: {
    fontSize: 34,
    fontWeight: "400",
    color: "#FFFFFF",
    letterSpacing: -0.9,
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(238, 244, 255, 0.9)",
    fontWeight: "400",
    textAlign: "center",
  },
  helperText: {
    marginTop: 8,
    color: "rgba(222, 232, 248, 0.74)",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 360,
  },
  form: {
    gap: 12,
  },
  googleSection: {
    marginBottom: 4,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "rgba(218, 230, 252, 0.6)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15.5,
    color: "#F4F8FF",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.24)",
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.25,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#0090FF',
    borderColor: '#0090FF',
  },
  checkboxLabel: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(228, 236, 250, 0.75)',
    textAlign: 'left',
    flexShrink: 1,
  },
  linkText: {
    color: '#F8FBFF',
    textDecorationLine: 'underline',
  },
  button: {
    marginTop: 4,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: 'center',
    backgroundColor: '#0090FF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: 'center',
    backgroundColor: '#F7FAFF',
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16, 24, 40, 0.08)',
  },
  googleButtonText: {
    color: "#16243F",
    fontSize: 15,
    fontWeight: "500",
  },
  switchButton: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 10,
  },
  switchButtonText: {
    color: "rgba(227, 236, 250, 0.68)",
    fontSize: 14,
    fontWeight: "400",
  },
});


