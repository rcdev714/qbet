import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useTheme } from "@/contexts/ThemeContext";
import { adminService, type AdminContentReportRow } from "@/services/admin.service";
import { moderationService } from "@/services/moderation.service";
import { Ionicons } from "@expo/vector-icons";
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
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

const STATUS_OPTIONS: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function targetLabel(type: string) {
  return type.replace(/_/g, " ");
}

export default function AdminReportsScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("admin");
  const { isWide } = useAdminLayoutMetrics();

  const [status, setStatus] = useState<ReportStatus>("open");
  const [rows, setRows] = useState<AdminContentReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const loadReports = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const result = await adminService.listContentReports({ status, limit: 100 });
      setRows(result.rows);
      setTotalCount(result.totalCount);
    } catch {
      Alert.alert(t("actionFailed"), t("loadReportsFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, t]);

  useEffect(() => {
    void loadReports(true);
  }, [loadReports]);

  const resolveReport = async (
    report: AdminContentReportRow,
    nextStatus: "resolved" | "dismissed" | "reviewing",
    restrictUser = false,
  ) => {
    setActionId(report.id);
    try {
      await moderationService.resolveContentReport({
        reportId: report.id,
        status: nextStatus,
        adminNotes: notesById[report.id]?.trim() || undefined,
        restrictUser,
      });
      await loadReports();
    } catch {
      Alert.alert(t("actionFailed"), t("resolveReportFailed"));
    } finally {
      setActionId(null);
    }
  };

  const renderRow = ({ item }: { item: AdminContentReportRow }) => {
    const busy = actionId === item.id;
    const severityColor =
      item.status === "open" ? theme.error : item.status === "reviewing" ? "#FF9500" : theme.textSecondary;

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.targetType, { color: theme.text }]}>{targetLabel(item.targetType)}</Text>
            <Text style={[styles.reason, { color: severityColor }]}>{item.reason}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${severityColor}22` }]}>
            <Text style={[styles.statusText, { color: severityColor }]}>
              {t(`reportStatus.${item.status}`)}
            </Text>
          </View>
        </View>

        {item.details ? (
          <Text style={[styles.details, { color: theme.textSecondary }]}>{item.details}</Text>
        ) : null}

        <View style={styles.metaGrid}>
          <MetaItem label={t("reporter")} value={item.reporterUsername ?? item.reporterId.slice(0, 8)} theme={theme} />
          <MetaItem
            label={t("targetUser")}
            value={item.targetUsername ?? (item.targetUserId ? item.targetUserId.slice(0, 8) : "—")}
            theme={theme}
          />
          <MetaItem label={t("submitted")} value={formatDate(item.createdAt)} theme={theme} />
          <MetaItem label={t("targetId")} value={`${item.targetId.slice(0, 10)}…`} theme={theme} />
        </View>

        {item.adminNotes ? (
          <Text style={[styles.adminNotes, { color: theme.textSecondary }]}>
            {t("adminNotes")}: {item.adminNotes}
          </Text>
        ) : null}

        {(item.status === "open" || item.status === "reviewing") && (
          <View style={styles.actionBlock}>
            <TextInput
              value={notesById[item.id] ?? ""}
              onChangeText={(text) => setNotesById((prev) => ({ ...prev, [item.id]: text }))}
              placeholder={t("adminNotes")}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.notesInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />
            <View style={[styles.actions, isWide && styles.actionsWide]}>
              <ActionButton
                label={t("markReviewing")}
                onPress={() => void resolveReport(item, "reviewing")}
                disabled={busy}
                theme={theme}
                variant="secondary"
              />
              <ActionButton
                label={t("resolve")}
                onPress={() => void resolveReport(item, "resolved")}
                disabled={busy}
                theme={theme}
              />
              <ActionButton
                label={t("dismiss")}
                onPress={() => void resolveReport(item, "dismissed")}
                disabled={busy}
                theme={theme}
                variant="secondary"
              />
              {item.targetUserId ? (
                <ActionButton
                  label={t("restrictUser")}
                  onPress={() => void resolveReport(item, "resolved", true)}
                  disabled={busy}
                  theme={theme}
                  variant="danger"
                />
              ) : null}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <AdminShell title={t("reports")} badge={status === "open" ? totalCount : undefined}>
        <View style={styles.headerBlock}>
          <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
            {t("reportCount", { count: totalCount })}
          </Text>
          <SegmentedControl
            segments={STATUS_OPTIONS.map((option) => ({
              value: option,
              label: t(`reportStatus.${option}`),
            }))}
            value={status}
            onChange={(value) => setStatus(value as ReportStatus)}
          />
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void loadReports();
                }}
                tintColor={theme.text}
              />
            }
            contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="shield-checkmark-outline" size={40} color={theme.textSecondary} />
                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>{t("noReports")}</Text>
              </View>
            }
          />
        )}
      </AdminShell>
    </>
  );
}

function MetaItem({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  theme,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  variant?: "primary" | "secondary" | "danger";
}) {
  const bg =
    variant === "danger"
      ? "#FF3B3022"
      : variant === "secondary"
        ? theme.background
        : theme.primarySoft;
  const color =
    variant === "danger" ? theme.error : variant === "secondary" ? theme.textSecondary : theme.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        { backgroundColor: bg, borderColor: variant === "primary" ? theme.primary : theme.border, opacity: disabled ? 0.5 : 1 },
        Platform.OS === "web" && ({ cursor: disabled ? "default" : "pointer" } as any),
      ]}
    >
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: 10, marginBottom: 16 },
  countLabel: { fontSize: 13, fontWeight: "500" },
  listContent: { gap: 12, paddingBottom: 24 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  targetType: { fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  reason: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  details: { fontSize: 13, lineHeight: 18 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { minWidth: "45%", flex: 1 },
  metaLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  metaValue: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  adminNotes: { fontSize: 12, fontStyle: "italic" },
  actionBlock: { gap: 8, marginTop: 4 },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 13,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionsWide: { flexWrap: "nowrap" },
  actionBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyList: { flexGrow: 1 },
});
