import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { AppScreen } from "@/components/ui/AppScreen";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useTheme } from "@/contexts/ThemeContext";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import {
    adminService,
    type AdminTransactionRow,
    type AdminTransactionType,
} from "@/services/admin.service";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const TYPE_FILTERS: Array<AdminTransactionType | "all"> = [
  "all",
  "deposit",
  "withdrawal",
  "bet_placed",
  "bet_won",
  "bet_refund",
  "transfer_sent",
  "transfer_received",
];

const STATUS_FILTERS = ["all", "completed", "pending", "failed"] as const;
const MODE_FILTERS = ["live", "play", "all"] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(type: string, amount: number) {
  const outflow = ["withdrawal", "bet_placed", "transfer_sent", "bet_lost"].includes(type);
  const prefix = outflow ? "−" : "+";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

function typeColor(type: string, theme: ReturnType<typeof useTheme>["theme"]) {
  if (type === "deposit" || type === "bet_won" || type === "transfer_received") return theme.success;
  if (type === "withdrawal" || type === "bet_placed" || type === "transfer_sent") return theme.error;
  return theme.primary;
}

export default function AdminTransactionsScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("admin");
  const { isWide } = useAdminLayoutMetrics();

  const [rows, setRows] = useState<AdminTransactionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AdminTransactionType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [modeFilter, setModeFilter] = useState<(typeof MODE_FILTERS)[number]>("live");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const result = await adminService.listTransactions({
        limit: 40,
        offset,
        type: typeFilter === "all" ? null : typeFilter,
        status: statusFilter === "all" ? null : statusFilter,
        isPlayMode: modeFilter === "all" ? null : modeFilter === "play",
        search: debouncedSearch || null,
      });
      setTotalCount(result.totalCount);
      setRows((prev) => (append ? [...prev, ...result.rows] : result.rows));
    },
    [debouncedSearch, modeFilter, statusFilter, typeFilter],
  );

  const reload = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      setLoadError(null);
      await loadPage(0, false);
    } catch {
      setLoadError(t("loadTransactionsFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadPage, t]);

  useEffect(() => {
    void reload(true);
  }, [reload]);

  const onLoadMore = async () => {
    if (loadingMore || rows.length >= totalCount) return;
    setLoadingMore(true);
    try {
      await loadPage(rows.length, true);
    } catch {
      showAppAlertRaw(t("actionFailed"), t("loadTransactionsFailed"));
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = useMemo(() => {
    const completed = rows.filter((r) => r.status === "completed");
    const deposits = completed.filter((r) => r.type === "deposit").reduce((s, r) => s + r.amount, 0);
    const withdrawals = completed.filter((r) => r.type === "withdrawal").reduce((s, r) => s + r.amount, 0);
    return { deposits, withdrawals, net: deposits - withdrawals };
  }, [rows]);

  const renderRow = ({ item }: { item: AdminTransactionRow }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <AppText variant="bodySm" style={{ textTransform: "capitalize", color: typeColor(item.type, theme) }}>
            {t(`txType.${item.type}`, { defaultValue: item.type })}
          </AppText>
          <AppText variant="bodySm" style={{ fontVariant: ["tabular-nums"] }}>
            {formatAmount(item.type, item.amount)}
          </AppText>
        </View>
        <AppText variant="caption" color="secondary">
          {item.username ?? t("unknownUser")} · {formatDate(item.createdAt)}
        </AppText>
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: theme.background }]}>
            <AppText variant="label" color="secondary" style={{ textTransform: "uppercase" }}>
              {item.status}
            </AppText>
          </View>
          {item.isPlayMode ? (
            <View style={[styles.tag, { backgroundColor: theme.primarySoft }]}>
              <AppText variant="label" color="primary">{t("playMode")}</AppText>
            </View>
          ) : (
            <View style={[styles.tag, { backgroundColor: theme.background }]}>
              <AppText variant="label" color="secondary">{t("liveMode")}</AppText>
            </View>
          )}
          {item.referenceId ? (
            <AppText variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {item.referenceId.slice(0, 18)}…
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <AdminShell title={t("transactions")}>
        <AppScreen maxWidth="wide" style={styles.adminScreen}>
        <View style={styles.toolbar}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("searchTransactions")}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.search,
              {
                color: theme.text,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          />
          <View style={styles.summaryRow}>
            <SummaryChip label={t("pageDeposits")} value={`$${summary.deposits.toFixed(2)}`} theme={theme} tone="success" />
            <SummaryChip label={t("pageWithdrawals")} value={`$${summary.withdrawals.toFixed(2)}`} theme={theme} tone="error" />
            <SummaryChip label={t("totalRecords")} value={String(totalCount)} theme={theme} />
          </View>
        </View>

        <View style={styles.filters}>
          <AppText variant="caption" color="secondary" style={{ fontWeight: '400', textTransform: "uppercase", marginBottom: 8 }}>
            {t("filterType")}
          </AppText>
          <FlatList
            horizontal
            data={TYPE_FILTERS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <FilterChip
                label={item === "all" ? t("filterAll") : t(`txType.${item}`, { defaultValue: item })}
                active={typeFilter === item}
                onPress={() => setTypeFilter(item)}
                theme={theme}
              />
            )}
          />
        </View>

        <View style={[styles.dualFilter, isWide && styles.dualFilterWide]}>
          <View style={styles.filterBlock}>
            <AppText variant="caption" color="secondary" style={{ fontWeight: '400', textTransform: "uppercase", marginBottom: 8 }}>
              {t("filterStatus")}
            </AppText>
            <SegmentedControl
              segments={STATUS_FILTERS.map((s) => ({
                value: s,
                label: s === "all" ? t("filterAll") : s,
              }))}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as (typeof STATUS_FILTERS)[number])}
            />
          </View>
          <View style={styles.filterBlock}>
            <AppText variant="caption" color="secondary" style={{ fontWeight: '400', textTransform: "uppercase", marginBottom: 8 }}>
              {t("filterMode")}
            </AppText>
            <SegmentedControl
              segments={MODE_FILTERS.map((m) => ({
                value: m,
                label: m === "all" ? t("filterAll") : m === "live" ? t("liveMode") : t("playMode"),
              }))}
              value={modeFilter}
              onChange={(v) => setModeFilter(v as (typeof MODE_FILTERS)[number])}
            />
          </View>
        </View>

        {loadError ? (
          <ErrorBanner
            message={loadError}
            onRetry={() => void reload(true)}
            retryLabel={t("retry", { ns: "common", defaultValue: "Retry" })}
          />
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.skeletonStack}>
            <AppSkeleton variant="row" />
            <AppSkeleton variant="row" />
            <AppSkeleton variant="row" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void reload(); }} tintColor={theme.text} />
            }
            onEndReached={() => void onLoadMore()}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <EmptyState icon="receipt-outline" title={t("noTransactions")} />
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.primary} style={{ marginVertical: 16 }} /> : null
            }
            contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
          />
        )}
        </AppScreen>
      </AdminShell>
    </>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.primarySoft : theme.surface,
          borderColor: active ? theme.primary : theme.border,
        },
        Platform.OS === "web" && ({ cursor: "pointer" } as any),
      ]}
    >
      <AppText variant="caption" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: '400' }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

function SummaryChip({
  label,
  value,
  theme,
  tone,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
  tone?: "success" | "error";
}) {
  const valueColor =
    tone === "success" ? theme.success : tone === "error" ? theme.error : theme.text;
  return (
    <View style={[styles.summaryChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppText variant="caption" color="secondary" style={{ fontWeight: '400', textTransform: "uppercase" }}>
        {label}
      </AppText>
      <AppText variant="title3" style={{ color: valueColor, marginTop: 4 }}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  adminScreen: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  skeletonStack: { gap: 8, marginTop: 8 },
  toolbar: { gap: 12, marginBottom: 16 },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    fontSize: 14,
  },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryChip: {
    flex: 1,
    minWidth: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
  },
  filters: { marginBottom: 12 },
  chipList: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dualFilter: { gap: 12, marginBottom: 16 },
  dualFilterWide: { flexDirection: "row" },
  filterBlock: { flex: 1, gap: 8 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  emptyList: { flexGrow: 1 },
});
