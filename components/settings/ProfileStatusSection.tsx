import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuthContext } from "@/contexts/AuthContext";
import { isMissingRpcError } from "@/lib/social/feed-visibility";
import { supabase } from "@/lib/supabase";
import { complianceService } from "@/services/compliance.service";

type ThemeColors = {
  text: string;
  textSecondary: string;
  surface: string;
  border: string;
  primary: string;
  primarySoft: string;
};

interface ProfileStatusSectionProps {
  theme: ThemeColors;
}

function StatusBadge({
  label,
  value,
  tone,
  theme,
  onPress,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral";
  theme: ThemeColors;
  onPress?: () => void;
}) {
  const bg =
    tone === "success"
      ? theme.primarySoft
      : tone === "warning"
        ? "rgba(255, 149, 0, 0.12)"
        : theme.surface;

  const content = (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: theme.border }]}>
      <Text style={[styles.badgeLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.badgeValue, { color: theme.text }]}>{value}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined}>
      {content}
    </Pressable>
  );
}

export function ProfileStatusSection({ theme }: ProfileStatusSectionProps) {
  const { user, refreshUser } = useAuthContext();
  const router = useRouter();
  const { t } = useTranslation("settings");
  const [bio, setBio] = useState("");
  const [betaApproved, setBetaApproved] = useState<boolean | null>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [liveWallet, setLiveWallet] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;

    const { data: profile } = await (supabase as any)
      .from("users")
      .select("bio, beta_approved")
      .eq("id", user.id)
      .single();

    if (profile) {
      setBio(profile.bio ?? "");
      setBetaApproved(profile.beta_approved ?? false);
    }

    const compliance = await complianceService.getProfile(user.id);
    if (compliance) {
      setKycStatus(compliance.kyc_status);
      setLiveWallet(compliance.live_wallet_enabled);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveBio = async () => {
    if (!user?.id) return;
    const nextBio = bio.trim();
    if (nextBio === (user.bio ?? "")) return;
    const { error } = await (supabase as any).rpc("update_own_profile", {
      p_username: user.username ?? "",
      p_display_name: user.display_name ?? "",
      p_bio: nextBio,
      p_avatar_url: user.avatar_url ?? "",
    });
    if (error && isMissingRpcError(error)) {
      await (supabase as any).from("users").update({ bio: nextBio || null }).eq("id", user.id);
    }
    await refreshUser();
  };

  const kycLabel =
    kycStatus === "verified" && liveWallet
      ? t("statusVerified")
      : kycStatus === "pending"
        ? t("statusPending")
        : t("statusNotVerified");

  const kycTone = kycStatus === "verified" && liveWallet ? "success" : "warning";

  return (
    <View style={styles.container}>
      <View style={styles.badges}>
        <StatusBadge
          theme={theme}
          label={t("statusBeta")}
          value={betaApproved ? t("statusApproved") : t("statusWaitlist")}
          tone={betaApproved ? "success" : "neutral"}
        />
        <StatusBadge
          theme={theme}
          label={t("statusKyc")}
          value={kycLabel}
          tone={kycTone}
          onPress={() => router.push("/wallet/verify" as any)}
        />
      </View>

      <View style={styles.bioField}>
        <Text style={[styles.bioLabel, { color: theme.textSecondary }]}>{t("bio")}</Text>
        <TextInput
          style={[
            styles.bioInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
            Platform.OS === "web" && ({ cursor: "text" } as any),
          ]}
          value={bio}
          onChangeText={setBio}
          onBlur={saveBio}
          placeholder={t("bioPlaceholder")}
          multiline
          maxLength={160}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    flex: 1,
    minWidth: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  bioField: {
    gap: 6,
  },
  bioLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  bioInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
});
