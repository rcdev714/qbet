import { AppButton, AppInput, AppText, ErrorBanner, FieldGroup } from "@/components/ui";
import { formatAuthError } from "@/lib/auth-errors";
import { getBetaAccessIntent } from "@/lib/beta-access-intent";
import { getParamString } from "@/lib/route-params";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { authService } from "@/services/auth.service";

export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuthContext();
  const { theme } = useTheme();
  const { t } = useTranslation("auth");
  const { t: tAccess } = useTranslation("accessRequest");
  const params = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const signupMode = getParamString(params.mode) === "signup";
  const [isLogin, setIsLogin] = useState(!signupMode);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [approvedIntent, setApprovedIntent] = useState(false);

  useEffect(() => {
    setIsLogin(getParamString(params.mode) !== "signup");
  }, [params.mode]);

  useEffect(() => {
    const paramEmail = getParamString(params.email);
    if (paramEmail) {
      setEmail(paramEmail);
      return;
    }
    void getBetaAccessIntent().then((intent) => {
      if (intent?.email) setEmail(intent.email);
      if (intent?.status === "approved") setApprovedIntent(true);
    });
  }, [params.email]);

  const handleAuth = async () => {
    if (!email || !password) {
      showAppAlertRaw(t("missingInfo"), t("missingInfoBody"));
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      showAppAlertRaw(t("checkPassword"), t("checkPasswordBody"));
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { user: newUser, error } = await signUp(email, password);
        if (error) throw error;

        if (!newUser) {
          Alert.alert(
            t("checkEmail"),
            t("checkEmailBody"),
            [{ text: "OK", onPress: () => setIsLogin(true) }],
          );
        }
      }
    } catch (error) {
      const errorMessage = formatAuthError(error, {
        invalidCredentials: __DEV__ ? t("invalidCredentialsDev") : t("invalidCredentials"),
        userAlreadyExists: t("userAlreadyExists"),
        weakPassword: t("weakPassword"),
        invalidEmail: t("invalidEmail"),
        generic: t("genericError"),
      });

      showAppAlertRaw(t("error"), errorMessage);
      setAuthError(errorMessage);
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/auth-bg.jpg")}
        style={[StyleSheet.absoluteFillObject, styles.backgroundImage]}
        contentFit="cover"
        transition={500}
      />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />

        <View style={styles.backgroundOverlay} />
        <View style={styles.authContainer}>
          <View
            style={[
              styles.authCard,
              {
                borderRadius: theme.radius.xl,
                borderColor: "rgba(255,255,255,0.22)",
              },
              Platform.select({
                web: {
                  boxShadow: "0px 28px 56px rgba(3, 8, 19, 0.35)",
                  backdropFilter: "blur(8px)",
                } as object,
                default: theme.elevation("lg"),
              }),
            ]}
          >
            <View style={styles.authHeader}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/images/icon.svg")}
                  style={styles.logo}
                  contentFit="contain"
                />
                <AppText variant="display" color="onPrimary" style={styles.brandName}>
                  Anymarkt
                </AppText>
              </View>
              <AppText variant="title3" style={styles.subtitle}>
                {isLogin ? t("welcomeBack") : t("createAccount")}
              </AppText>
              {!isLogin ? (
                <AppText variant="bodySm" color="secondary" style={styles.helperText}>
                  {t("signupHelper")}
                </AppText>
              ) : null}
              {approvedIntent ? (
                <AppText variant="bodySm" color="success" style={styles.approvedBanner}>
                  {tAccess("approvedLoginBanner")}
                </AppText>
              ) : null}
            </View>

            <View style={styles.form}>
              {Platform.OS === "web" ? (
                <View style={styles.googleSection}>
                  <AppButton
                    title={isLogin ? t("continueGoogle") : t("createGoogle")}
                    variant="secondary"
                    loading={authSubmitting}
                    disabled={authSubmitting}
                    onPress={async () => {
                      setAuthSubmitting(true);
                      try {
                        const { error } = await signInWithGoogle();
                        if (error) {
                          showAppAlertRaw(t("error"), error.message);
                        }
                      } finally {
                        setAuthSubmitting(false);
                      }
                    }}
                    icon={<Ionicons name="logo-google" size={20} color={theme.text} />}
                  />

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <AppText variant="caption" color="muted" style={styles.dividerText}>
                      {t("orEmail")}
                    </AppText>
                    <View style={styles.dividerLine} />
                  </View>
                </View>
              ) : null}

              <FieldGroup>
                <AppInput
                  testID="login-email"
                  variant="onDark"
                  placeholder={t("email")}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <AppInput
                  testID="login-password"
                  variant="onDark"
                  placeholder={t("password")}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {!isLogin ? (
                  <AppInput
                    testID="login-confirm-password"
                    variant="onDark"
                    placeholder={t("confirmPassword")}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                ) : null}
              </FieldGroup>

              {isLogin ? (
                <AppButton
                  title={showForgotPassword ? t("sendingReset") : t("forgotPassword")}
                  variant="ghost"
                  size="sm"
                  disabled={showForgotPassword}
                  onPress={async () => {
                    if (!email) {
                      showAppAlertRaw(t("missingInfo"), t("missingInfoBody"));
                      return;
                    }
                    setShowForgotPassword(true);
                    const { error } = await authService.resetPasswordForEmail(email);
                    setShowForgotPassword(false);
                    if (error) {
                      showAppAlertRaw(t("error"), error.message);
                      return;
                    }
                    Alert.alert(t("resetEmailSent"), t("resetEmailSentBody"));
                  }}
                  style={styles.forgotButton}
                />
              ) : null}

              {authError ? (
                <View testID="login-error">
                  <ErrorBanner message={authError} />
                </View>
              ) : null}

              <AppButton
                testID="login-submit"
                title={isLogin ? t("signIn") : t("createAccountButton")}
                loading={authSubmitting}
                onPress={handleAuth}
              />

              <AppButton
                testID="signup-toggle"
                title={isLogin ? t("switchToSignup") : t("switchToLogin")}
                variant="ghost"
                onPress={() => {
                  setIsLogin(!isLogin);
                  setConfirmPassword("");
                }}
                style={styles.switchButton}
              />
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
  backgroundImage: {
    width: "100%",
    height: "100%",
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
    padding: 24,
    backgroundColor: "rgba(15, 25, 43, 0.7)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  authHeader: {
    marginBottom: 22,
    alignItems: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandName: {
    letterSpacing: -0.9,
  },
  subtitle: {
    color: "rgba(238, 244, 255, 0.9)",
    textAlign: "center",
  },
  helperText: {
    marginTop: 8,
    textAlign: "center",
    maxWidth: 360,
  },
  approvedBanner: {
    marginTop: 10,
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
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  switchButton: {
    marginTop: 4,
  },
});
