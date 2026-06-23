import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { AppScreen } from "@/components/ui/AppScreen";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useTheme } from "@/contexts/ThemeContext";
import { formatActionError } from "@/lib/admin-action-errors";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import {
    betaAccessService,
    type BetaAccessRequest,
    type BetaAccessRequestStatus,
} from "@/services/betaAccess.service";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

function confirmOnWeb(message: string): boolean {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(message);
  }
  return false;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsersScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("admin");
  const { isWide } = useAdminLayoutMetrics();

  const [status, setStatus] = useState<BetaAccessRequestStatus>("pending");
  const [requests, setRequests] = useState<BetaAccessRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRequests = useCallback(async (showLoader = false, statusOverride?: BetaAccessRequestStatus) => {
    const activeStatus = statusOverride ?? status;
    if (showLoader) setLoading(true);
    try {
      setLoadError(null);
      const [list, pending] = await Promise.all([
        betaAccessService.listRequests(activeStatus),
        activeStatus === "pending" ? Promise.resolve([]) : betaAccessService.listRequests("pending"),
      ]);
      setRequests(list);
      if (activeStatus === "pending") {
        setPendingCount(list.length);
      } else {
        setPendingCount(pending.length);
      }
    } catch {
      setLoadError(t("loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, t]);

  useEffect(() => {
    void loadRequests(true);
  }, [loadRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadRequests(false);
  };

  const confirmAction = (request: BetaAccessRequest, action: "approve" | "decline") => {
    const notes = notesById[request.id]?.trim() || null;
    const title =
      action === "approve"
        ? t("approveConfirm", { email: request.email })
        : t("declineConfirm", { email: request.email });

    if (Platform.OS === "web") {
      if (!confirmOnWeb(title)) return;
      void runAction(request.id, action, notes, request.email);
      return;
    }

    Alert.alert(title, undefined, [
      { text: t("cancel"), style: "cancel" },
      {
        text: action === "approve" ? t("approve") : t("decline"),
        style: action === "decline" ? "destructive" : "default",
        onPress: () => void runAction(request.id, action, notes, request.email),
      },
    ]);
  };

  const sendApprovalEmail = async (requestId: string, forceResend = false, email?: string) => {
    setActionId(requestId);
    setBanner(null);
    try {
      const result = await betaAccessService.sendApprovalEmail(requestId, forceResend);
      await loadRequests(false);
      setBanner({
        tone: "success",
        message: result.skipped
          ? t("emailAlreadySent")
          : t("emailSentSuccess", { email: email ?? "" }),
      });
    } catch (error) {
      const message = formatActionError(error);
      setBanner({ tone: "error", message: `${t("emailFailedBody")} (${message})` });
      if (Platform.OS !== "web") {
        showAppAlertRaw(t("emailFailed"), t("emailFailedBody"));
      }
    } finally {
      setActionId(null);
    }
  };

  const runAction = async (
    id: string,
    action: "approve" | "decline",
    notes: string | null,
    email: string,
  ) => {
    setActionId(id);
    setBanner(null);
    try {
      if (action === "approve") {
        await betaAccessService.approveRequest(id, notes);
        try {
          const result = await betaAccessService.sendApprovalEmail(id);
          setBanner({
            tone: "success",
            message: result.skipped
              ? t("approveSuccessEmailAlreadySent", { email })
              : t("approveSuccessEmailSent", { email }),
          });
        } catch (emailError) {
          setBanner({
            tone: "error",
            message: t("approveSuccessEmailFailed", {
              email,
              error: formatActionError(emailError),
            }),
          });
        }
        setStatus("approved");
        await loadRequests(false, "approved");
      } else {
        await betaAccessService.declineRequest(id, notes);
        setBanner({ tone: "success", message: t("declineSuccess", { email }) });
        await loadRequests(false);
      }
    } catch (error) {
      const message = formatActionError(error);
      setBanner({ tone: "error", message: `${t("actionFailed")}: ${message}` });
      if (Platform.OS !== "web") {
        showAppAlertRaw(t("actionFailed"), message);
      }
    } finally {
      setActionId(null);
    }
  };

  const renderItem = ({ item }: { item: BetaAccessRequest }) => {
    const isActing = actionId === item.id;
    const showActions = status === "pending";
    const requestTestId = `beta-request-${item.email.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

    return (
      <View
        testID={requestTestId}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
          isWide && showActions && styles.cardWide,
        ]}
      >
        <View style={[styles.cardBody, isWide && showActions && styles.cardBodyWide]}>
          <View style={styles.rowMain}>
            <AppText variant="bodySm" style={{ fontWeight: "600" }}>{item.email}</AppText>
            {item.full_name ? (
              <AppText variant="bodySm" color="secondary">{item.full_name}</AppText>
            ) : null}
            <AppText variant="caption" color="secondary">
              {item.country_code} · {t("submitted")} {formatDate(item.created_at)}
            </AppText>
            {item.message ? (
              <AppText variant="bodySm" color="secondary" style={{ marginTop: 4, lineHeight: 18 }}>
                {item.message}
              </AppText>
            ) : null}
            {item.user_id ? (
              <View style={[styles.linkedBadge, { backgroundColor: theme.primarySoft }]}>
                <AppText variant="caption" color="primary" style={{ fontWeight: "600" }}>
                  {t("linkedAccount")}
                </AppText>
              </View>
            ) : null}
            {status === "approved" ? (
              <AppText variant="caption" color="secondary">
                {item.approval_email_sent_at
                  ? t("emailSent", { date: formatDate(item.approval_email_sent_at) })
                  : t("emailNotSent")}
              </AppText>
            ) : null}
          </View>

          {showActions && isWide ? (
            <View style={styles.actionsWide}>
              <TouchableOpacity
                testID={`${requestTestId}-approve`}
                disabled={isActing}
                onPress={() => confirmAction(item, "approve")}
                style={[styles.approveBtn, styles.actionBtnWide, isActing && styles.btnDisabled]}
                activeOpacity={0.85}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <AppText variant="bodySm" color="onPrimary" style={{ fontWeight: "600" }}>{t("approve")}</AppText>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isActing}
                onPress={() => confirmAction(item, "decline")}
                style={[styles.declineBtn, styles.actionBtnWide, isActing && styles.btnDisabled]}
                activeOpacity={0.85}
              >
                <AppText variant="bodySm" color="destructive" style={{ fontWeight: "600" }}>{t("decline")}</AppText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {showActions ? (
          <TextInput
            value={notesById[item.id] ?? ""}
            onChangeText={(text) => setNotesById((prev) => ({ ...prev, [item.id]: text }))}
            placeholder={t("adminNotes")}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.notesInput,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.input,
              },
              Platform.OS === "web" && ({ cursor: "text" } as any),
            ]}
          />
        ) : item.admin_notes ? (
          <AppText variant="caption" color="secondary" style={{ fontStyle: "italic" }}>{item.admin_notes}</AppText>
        ) : null}

        {status === "approved" ? (
          <TouchableOpacity
            disabled={isActing}
            onPress={() => void sendApprovalEmail(item.id, true, item.email)}
            style={[styles.resendBtn, { borderColor: theme.border }, isActing && styles.btnDisabled]}
            activeOpacity={0.85}
          >
            {isActing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <AppText variant="bodySm" color="primary" style={{ fontWeight: "600" }}>{t("resendApprovalEmail")}</AppText>
            )}
          </TouchableOpacity>
        ) : null}

        {showActions && !isWide ? (
          <View style={styles.actionsMobile}>
            <TouchableOpacity
              testID={`${requestTestId}-approve`}
              disabled={isActing}
              onPress={() => confirmAction(item, "approve")}
              style={[styles.approveBtn, styles.actionBtnMobile, isActing && styles.btnDisabled]}
              activeOpacity={0.85}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <AppText variant="bodySm" color="onPrimary" style={{ fontWeight: "600" }}>{t("approve")}</AppText>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isActing}
              onPress={() => confirmAction(item, "decline")}
              style={[styles.declineBtn, styles.actionBtnMobile, isActing && styles.btnDisabled]}
              activeOpacity={0.85}
            >
              <AppText variant="bodySm" color="destructive" style={{ fontWeight: "600" }}>{t("decline")}</AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <AdminShell title={t("accessRequests")} badge={pendingCount}>
        <AppScreen maxWidth="wide" style={styles.adminScreen}>
          <View style={styles.content}>
            <SegmentedControl
              value={status}
              onChange={setStatus}
              segments={[
                { value: "pending", label: t("pending") },
                { value: "approved", label: t("approved") },
                { value: "declined", label: t("declined") },
              ]}
            />

            {loadError ? (
              <ErrorBanner
                message={loadError}
                onRetry={() => void loadRequests(true)}
                retryLabel={t("retry", { ns: "common", defaultValue: "Retry" })}
              />
            ) : null}

            {banner ? (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: banner.tone === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    borderColor: banner.tone === "success" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
                  },
                ]}
              >
                <AppText
                  variant="bodySm"
                  style={{
                    color: banner.tone === "success" ? "#059669" : "#DC2626",
                    fontWeight: "500",
                    lineHeight: 20,
                  }}
                >
                  {banner.message}
                </AppText>
              </View>
            ) : null}

            {loading && !refreshing ? (
              <View style={styles.skeletonStack}>
                <AppSkeleton variant="row" />
                <AppSkeleton variant="row" />
                <AppSkeleton variant="row" />
              </View>
            ) : (
              <FlatList
                style={styles.list}
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
                }
                contentContainerStyle={requests.length === 0 ? styles.emptyList : styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={<EmptyState icon="mail-outline" title={t("noRequests")} />}
              />
            )}
          </View>
        </AppScreen>
      </AdminShell>
    </>
  );
}

const styles = StyleSheet.create({
  adminScreen: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  content: {
    flex: 1,
    gap: 16,
    minHeight: 0,
  },
  skeletonStack: { gap: 10, marginTop: 8 },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 24,
  },
  separator: {
    height: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  cardWide: {
    paddingVertical: 14,
  },
  cardBody: {
    gap: 12,
  },
  cardBodyWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },
  rowMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  linkedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 36,
  },
  actionsWide: {
    width: 120,
    gap: 8,
    flexShrink: 0,
  },
  actionsMobile: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtnWide: {
    width: "100%",
  },
  actionBtnMobile: {
    flex: 1,
  },
  approveBtn: {
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    minHeight: 38,
    justifyContent: "center",
  },
  declineBtn: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    minHeight: 38,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resendBtn: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: "center",
  },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
