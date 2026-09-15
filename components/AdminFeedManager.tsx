import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { decode } from "base64-arraybuffer";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { AppButton, AppIconButton, AppText } from "@/components/ui";
import { getTextStyle } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import { scanMarketTextForSports } from "@/lib/compliance/sports-content";
import { supabase } from "@/lib/supabase";
import { adminService } from "@/services/admin.service";
import {
    FEED_CATEGORIES,
    type FeedCategory,
    type FeedMarketSuggestion,
    feedService,
} from "@/services/feed.service";
import type { Market } from "@/types/market";

export type AdminFeedManagerTab = "suggestions" | "promote" | "create" | "manage" | "resolve";

interface AdminFeedManagerProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: AdminFeedManagerTab;
}

type Tab = AdminFeedManagerTab;

type ManageStatusFilter = "all" | "open" | "closed" | "resolved";

const ADMIN_MARKET_LIMIT = 200;

function formatActionError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

interface MarketOption {
  id: string;
  label: string;
  total_pool: number;
}

export function AdminFeedManager({ visible, onClose, initialTab = "suggestions" }: AdminFeedManagerProps) {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [candidates, setCandidates] = useState<Market[]>([]);
  const [activeMarkets, setActiveMarkets] = useState<Market[]>([]);
  const [openMarketsForResolve, setOpenMarketsForResolve] = useState<Market[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Edit State
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);

  // Create/Edit form state
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<FeedCategory>("Politics");
  const [isBinaryMarket, setIsBinaryMarket] = useState(true); // Default to binary Yes/No
  const [options, setOptions] = useState(["Yes", "No"]);
  const [closesAt, setClosesAt] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  ); // Default 7 days
  const [imageUrl, setImageUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Resolve State
  const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null);
  const [marketOptions, setMarketOptions] = useState<MarketOption[]>([]);
  const [selectedWinningOption, setSelectedWinningOption] = useState<
    string | null
  >(null);
  const [resolving, setResolving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [manageStatusFilter, setManageStatusFilter] =
    useState<ManageStatusFilter>("all");
  const [suggestions, setSuggestions] = useState<FeedMarketSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionSourceId, setSuggestionSourceId] = useState<string | null>(null);

  const filteredManageMarkets = useMemo(() => {
    if (manageStatusFilter === "all") return activeMarkets;
    return activeMarkets.filter((market) => market.status === manageStatusFilter);
  }, [activeMarkets, manageStatusFilter]);

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const { suggestions: rows, error } = await feedService.getFeedSuggestions({
        status: "pending",
        limit: 100,
      });
      if (error) throw error;
      setSuggestions(rows);
    } catch (err) {
      console.error("Error fetching feed suggestions:", err);
      Alert.alert("Error", formatActionError(err, "Failed to load suggestions"));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Fetch recent private markets that are candidates for the feed
  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .eq("is_public", false)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const markets = (data ?? []) as Market[];
      if (markets.length === 0) {
        setCandidates([]);
        return;
      }

      const { data: optionRows, error: optionsError } = await supabase
        .from("options")
        .select("market_id")
        .in("market_id", markets.map((market) => market.id));

      if (optionsError) throw optionsError;

      const optionCounts = new Map<string, number>();
      for (const row of optionRows ?? []) {
        if (!row.market_id) continue;
        optionCounts.set(row.market_id, (optionCounts.get(row.market_id) ?? 0) + 1);
      }

      setCandidates(
        markets.filter((market) => (optionCounts.get(market.id) ?? 0) >= 2),
      );
    } catch (err) {
      console.error("Error fetching candidates:", err);
      Alert.alert("Error", "Failed to load candidate markets");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveMarkets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(ADMIN_MARKET_LIMIT);

      if (error) throw error;
      setActiveMarkets(data as Market[]);
    } catch (err) {
      console.error("Error fetching active markets:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenMarketsForResolve = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .eq("is_public", true)
        .in("status", ["open", "closed"])
        .order("created_at", { ascending: false })
        .limit(ADMIN_MARKET_LIMIT);

      if (error) throw error;
      setOpenMarketsForResolve(data as Market[]);
    } catch (err) {
      console.error("Error fetching open markets for resolve:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketOptions = async (marketId: string) => {
    setLoadingOptions(true);
    try {
      const options = await feedService.getMarketOptions(marketId);
      setMarketOptions(options);
    } catch (err) {
      console.error("Error fetching market options:", err);
      setMarketOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSelectMarketToResolve = async (market: Market) => {
    setResolvingMarket(market);
    setSelectedWinningOption(null);
    setEvidenceUrl("");
    setEvidenceNotes("");
    await fetchMarketOptions(market.id);
  };

  const handleResolveMarket = async () => {
    if (!resolvingMarket || !selectedWinningOption) return;

    const selectedOption = marketOptions.find((o) =>
      o.id === selectedWinningOption
    );

    Alert.alert(
      "Confirm Resolution",
      `Are you sure you want to resolve "${resolvingMarket.question}" with winner "${selectedOption?.label}"?\n\nThis will distribute all winnings to participants and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve & Distribute",
          style: "destructive",
          onPress: async () => {
            setResolving(true);
            try {
              const { error } = await feedService.resolvePublicMarket(
                resolvingMarket.id,
                selectedWinningOption,
                evidenceUrl.trim() || undefined,
                evidenceNotes.trim() || undefined,
              );

              if (error) throw error;

              Alert.alert(
                "Success",
                "Market resolved! Payouts have been distributed to winners.",
              );
              setResolvingMarket(null);
              setSelectedWinningOption(null);
              setMarketOptions([]);
              fetchOpenMarketsForResolve();
            } catch (err) {
              console.error("Error resolving market:", err);
              Alert.alert(
                "Error",
                formatActionError(err, "Failed to resolve market. Please try again."),
              );
            } finally {
              setResolving(false);
            }
          },
        },
      ],
    );
  };

  const cancelResolve = () => {
    setResolvingMarket(null);
    setSelectedWinningOption(null);
    setMarketOptions([]);
    setEvidenceUrl("");
    setEvidenceNotes("");
  };

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  useEffect(() => {
    if (visible) {
      if (activeTab === "manage") {
        fetchActiveMarkets();
      } else if (activeTab === "resolve") {
        fetchOpenMarketsForResolve();
      } else if (activeTab === "suggestions") {
        fetchSuggestions();
      } else {
        fetchCandidates();
      }
      // removing resetForm() here to prevent clearing state when switching tabs during edit
    }
  }, [visible, activeTab]);

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setQuestion("");
    setCategory("Politics");
    setIsBinaryMarket(true);
    setOptions(["Yes", "No"]);
    setClosesAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setImageUrl("");
    setEditingMarketId(null);
    setSuggestionSourceId(null);
  };

  const handleEdit = (market: Market) => {
    setEditingMarketId(market.id);
    setQuestion(market.question || ""); // Handle possible null
    setCategory((market.category as FeedCategory) || "Politics");
    setOptions([]); // We don't edit options for now to avoid specific logic complexity
    setClosesAt(new Date(market.closes_at || Date.now()));
    setImageUrl(market.image_url || "");
    setActiveTab("create"); // Switch to form view
  };

  const handlePromote = async (marketId: string) => {
    setProcessingId(marketId);
    try {
      const error = await feedService.promoteMarketToFeed(marketId);
      if (error) throw error;

      setCandidates((prev) => prev.filter((m) => m.id !== marketId));
      Alert.alert("Success", "Market promoted to public feed");
    } catch (err) {
      console.error("Error promoting market:", err);
      Alert.alert("Error", formatActionError(err, "Failed to promote market"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveForFeed = async (marketId: string) => {
    setProcessingId(marketId);
    try {
      const error = await feedService.approveMarketForFeed(marketId);
      if (error) throw error;

      await fetchActiveMarkets();
      Alert.alert("Success", "Market approved for public feed");
    } catch (err) {
      console.error("Error approving market:", err);
      Alert.alert("Error", formatActionError(err, "Failed to approve market for feed"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleSave = async () => {
    if (!question.trim()) {
      Alert.alert("Error", "Please enter a question");
      return;
    }

    const sportsScan = scanMarketTextForSports({
      question,
      optionLabels: options,
      category,
    });
    if (sportsScan.blocked) {
      Alert.alert(
        "Sports content detected",
        "This market text matches sports-betting patterns blocked for Ecuador users. Adjust the question or options before saving.",
      );
      return;
    }

    setCreating(true);
    try {
      if (editingMarketId) {
        // UPDATE EXISTING
        const error = await feedService.updatePublicMarket(editingMarketId, {
          question: question.trim(),
          category,
          closesAt,
          imageUrl: imageUrl.trim() || undefined,
        });
        if (error) throw error;

        Alert.alert("Success", "Market updated successfully");
        setEditingMarketId(null);
        setActiveTab("manage");
      } else {
        // CREATE NEW
        if (options.length < 2) {
          Alert.alert("Error", "Please add at least 2 options");
          setCreating(false);
          return;
        }

        const { market, error } = await feedService.createPublicMarket({
          question: question.trim(),
          category,
          options: options.filter((o) => o.trim()),
          closesAt,
          imageUrl: imageUrl.trim() || undefined,
          marketType: isBinaryMarket ? "binary" : "multi_option",
        });

        if (error) throw error;

        if (suggestionSourceId && market?.id) {
          const sourceSuggestion = suggestions.find((item) => item.id === suggestionSourceId);
          const markError = await feedService.markSuggestionCreated(
            suggestionSourceId,
            market.id,
            sourceSuggestion
              ? {
                original_question: sourceSuggestion.question,
                final_question: question.trim(),
                original_options: sourceSuggestion.options,
                final_options: options.filter((o) => o.trim()),
                original_closes_at: sourceSuggestion.suggested_closes_at,
                final_closes_at: closesAt.toISOString(),
              }
              : undefined,
          );
          if (markError) {
            console.warn("Failed to link suggestion to market:", markError);
          }
          setSuggestionSourceId(null);
          fetchSuggestions();
        }

        Alert.alert("Success", "Public market created! Compliance review runs automatically before feed visibility.", [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              setActiveTab("manage");
            },
          },
        ]);
      }
    } catch (err) {
      console.error("Error saving market:", err);
      Alert.alert("Error", "Failed to save market");
    } finally {
      setCreating(false);
    }
  };

  const dismissSuggestionWithReason = async (suggestionId: string, reason: string) => {
    setProcessingId(suggestionId);
    try {
      const error = await feedService.dismissFeedSuggestion(suggestionId, reason);
      if (error) throw error;
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
    } catch (err) {
      console.error("Error dismissing suggestion:", err);
      Alert.alert("Error", formatActionError(err, "Failed to dismiss suggestion"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    Alert.alert(
      "Dismiss suggestion",
      "Why should this suggestion be blocked?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Not engaging",
          onPress: () => dismissSuggestionWithReason(suggestionId, "not_engaging"),
        },
        {
          text: "Quality issue",
          style: "destructive",
          onPress: () => dismissSuggestionWithReason(suggestionId, "weak_sources"),
        },
      ],
    );
  };

  const handleUseSuggestion = (suggestion: FeedMarketSuggestion) => {
    const labels = suggestion.options.filter(Boolean);
    setQuestion(suggestion.question);
    setCategory(
      FEED_CATEGORIES.includes(suggestion.category as FeedCategory)
        ? (suggestion.category as FeedCategory)
        : "Politics",
    );
    setIsBinaryMarket(labels.length === 2);
    setOptions(labels.length >= 2 ? labels : ["Yes", "No"]);
    setClosesAt(new Date(suggestion.suggested_closes_at));
    setImageUrl("");
    setEditingMarketId(null);
    setSuggestionSourceId(suggestion.id);
    setActiveTab("create");
  };

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, FeedMarketSuggestion[]>();
    for (const item of suggestions) {
      const batchKey = item.batch_id;
      const list = groups.get(batchKey) ?? [];
      list.push(item);
      groups.set(batchKey, list);
    }
    return [...groups.entries()].map(([batchId, items]) => ({
      batchId,
      header: items[0]?.batch
        ? `${items[0].batch.run_date} · ${items[0].batch.cron_slot} ET`
        : "Suggestions",
      items,
    }));
  }, [suggestions]);

  const renderSuggestionsContent = () => {
    if (suggestionsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    if (groupedSuggestions.length === 0) {
      return (
        <View style={styles.center}>
          <AppText variant="body" color="secondary" style={{ textAlign: 'center', paddingHorizontal: 24 }}>
            No pending AI suggestions. New batches arrive at 8am, 12pm, and 3pm ET.
          </AppText>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.suggestionsList}>
        {groupedSuggestions.map((group) => (
          <View key={group.batchId} style={styles.suggestionGroup}>
            <AppText variant="bodySm" style={{ color: theme.text }}>
              {group.header}
            </AppText>
            {group.items.map((item) => (
              <View
                key={item.id}
                style={[styles.suggestionCard, {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderRadius: theme.radius.md,
                }]}
              >
                <View style={styles.suggestionMetaRow}>
                  <AppText variant="caption" color="primary" style={{ textTransform: 'uppercase' }}>
                    {item.category}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    {item.horizon === "near_term" ? "Near-term" : "Long-term"}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    {item.autopilot_status === "eligible"
                      ? `Autopilot eligible · ${item.autopilot_score}`
                      : `${item.autopilot_status.replace("_", " ")} · ${item.autopilot_score}`}
                  </AppText>
                </View>
                <AppText variant="bodySm" color="secondary">{item.subject}</AppText>
                <AppText variant="title3">{item.question}</AppText>
                <AppText variant="bodySm" color="secondary">
                  Options: {item.options.join(" · ")}
                </AppText>
                <AppText variant="caption" color="secondary">
                  Closes {new Date(item.suggested_closes_at).toLocaleString()}
                </AppText>
                <AppText variant="caption" color="secondary">
                  Source score {item.source_quality_score} · Resolution score {item.resolution_quality_score} · Engagement {item.engagement_score}
                </AppText>
                {item.rationale ? (
                  <AppText variant="bodySm" color="secondary">{item.rationale}</AppText>
                ) : null}
                {item.resolution_criteria ? (
                  <AppText variant="bodySm" color="secondary">
                    Resolution: {item.resolution_criteria}
                  </AppText>
                ) : null}
                {item.autopilot_reasons?.length ? (
                  <AppText variant="caption" color="secondary">
                    Checks: {item.autopilot_reasons.slice(0, 4).join(", ")}
                  </AppText>
                ) : null}
                {item.evidence_sources?.length ? (
                  <AppText variant="caption" color="secondary">
                    Evidence: {item.evidence_sources.slice(0, 3).map((source) =>
                      `${source.publisher || "Source"} (${source.source_type})`
                    ).join(", ")}
                  </AppText>
                ) : null}
                {item.source_urls?.length ? (
                  <AppText variant="caption" color="secondary">
                    Sources: {item.source_urls.slice(0, 3).join(", ")}
                  </AppText>
                ) : null}
                <View style={styles.suggestionActions}>
                  <AppButton
                    title="Use in Create"
                    variant="primary"
                    size="sm"
                    onPress={() => handleUseSuggestion(item)}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Dismiss"
                    variant="secondary"
                    size="sm"
                    disabled={processingId === item.id}
                    onPress={() => handleDismissSuggestion(item.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Images and videos
        allowsEditing: true,
        aspect: [9, 16], // Portrait aspect ratio
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadMedia(result.assets[0]);
      }
    } catch (error: any) {
      Alert.alert("Error picking media", error.message);
    }
  };

  const uploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploading(true);

      if (!asset.base64) {
        throw new Error("No media data found (base64 is missing)");
      }

      const arrayBuffer = decode(asset.base64);
      const ext = asset.uri.substring(asset.uri.lastIndexOf(".") + 1);
      const fileName = `markets/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("market-images")
        .upload(fileName, arrayBuffer, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("market-images")
        .getPublicUrl(fileName);

      setImageUrl(publicUrl);
      console.log("Uploaded market media:", publicUrl);
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Error uploading media", error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!question.trim()) {
      Alert.alert("Error", "Please enter a question to generate an image for.");
      return;
    }

    try {
      setIsGeneratingImage(true);
      const url = await adminService.generateMarketImage(question.trim());
      setImageUrl(url);
    } catch (error: any) {
      console.error("Image generation failed:", error);
      Alert.alert("Generation Failed", error.message || "Failed to generate AI image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDelete = (marketId: string) => {
    Alert.alert(
      "Delete Market",
      "Are you sure you want to delete this market? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setProcessingId(marketId);
            try {
              const error = await feedService.deletePublicMarket(marketId);
              if (error) throw error;
              // Remove from list locally
              setActiveMarkets((prev) => prev.filter((m) => m.id !== marketId));
              Alert.alert("Success", "Market deleted successfully");
            } catch (err) {
              console.error("Error deleting market:", err);
              Alert.alert(
                "Error",
                formatActionError(err, "Failed to delete market"),
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const renderResolveContent = () => {
    if (resolvingMarket) {
      // Show resolution UI for selected market
      const totalPool = marketOptions.reduce(
        (sum, opt) => sum + (opt.total_pool || 0),
        0,
      );

      return (
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
        >
          <TouchableOpacity
            style={[styles.backButton, { marginBottom: 16 }]}
            onPress={cancelResolve}
          >
            <Ionicons name="arrow-back" size={20} color={theme.primary} />
            <AppText variant="body" color="primary" style={{ marginLeft: 8 }}>
              Back to Markets
            </AppText>
          </TouchableOpacity>

          <View
            style={[styles.resolveHeader, {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderRadius: theme.radius.md,
            }]}
          >
            <AppText variant="title2" style={{ color: theme.text, marginBottom: 12 }}>
              {resolvingMarket.question}
            </AppText>
            <View style={styles.resolveStats}>
              <AppText variant="bodySm" color="secondary">
                Category: {resolvingMarket.category || "General"}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Total Pool: ${totalPool.toLocaleString()}
              </AppText>
            </View>
          </View>

          <AppText variant="label" style={{ color: theme.text, marginTop: 16, marginBottom: 8 }}>
            Select Winning Option
          </AppText>
          <AppText variant="bodySm" color="secondary" style={{ marginBottom: 16, marginLeft: 4 }}>
            Winners will receive proportional payouts (minus 7.95% platform fee)
          </AppText>

          {loadingOptions
            ? (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={{ margin: 20 }}
              />
            )
            : (
              <View style={styles.optionsContainer}>
                {marketOptions.map((option) => {
                  const percentage = totalPool > 0
                    ? ((option.total_pool / totalPool) * 100).toFixed(1)
                    : "0";
                  const isSelected = selectedWinningOption === option.id;

                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.resolveOption,
                        {
                          backgroundColor: isSelected
                            ? `${theme.success}20`
                            : theme.surface,
                          borderColor: isSelected ? theme.success : theme.border,
                          borderRadius: theme.radius.md,
                        },
                      ]}
                      onPress={() => setSelectedWinningOption(option.id)}
                    >
                      <View style={styles.resolveOptionLeft}>
                        <View
                          style={[
                            styles.radioButton,
                            {
                              borderColor: isSelected
                                ? theme.success
                                : theme.border,
                              borderRadius: theme.radius.pill,
                            },
                          ]}
                        >
                          {isSelected && (
                            <View style={[styles.radioButtonInner, { backgroundColor: theme.success, borderRadius: theme.radius.pill }]} />
                          )}
                        </View>
                        <AppText variant="title3" style={{ color: theme.text, flex: 1 }}>
                          {option.label}
                        </AppText>
                      </View>
                      <View style={styles.resolveOptionRight}>
                        <AppText variant="bodySm" color="secondary">
                          ${option.total_pool.toLocaleString()}
                        </AppText>
                        <AppText variant="caption" color="primary" style={{ marginTop: 2 }}>
                          {`${percentage}%`}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          {/* Evidence Section */}
          <AppText variant="label" style={{ color: theme.text, marginTop: 16, marginBottom: 8 }}>
            Resolution Evidence (Recommended)
          </AppText>
          <AppText variant="bodySm" color="secondary" style={{ marginBottom: 8, marginLeft: 4 }}>
            Add proof for transparency and dispute prevention
          </AppText>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
              borderRadius: theme.radius.sm,
            }]}
            placeholder="Evidence URL (news article, official source, etc.)"
            placeholderTextColor={theme.textSecondary}
            value={evidenceUrl}
            onChangeText={setEvidenceUrl}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
              borderRadius: theme.radius.sm,
              height: 80,
              textAlignVertical: "top",
              marginTop: 8,
            }]}
            placeholder="Resolution notes (explain your decision...)"
            placeholderTextColor={theme.textSecondary}
            value={evidenceNotes}
            onChangeText={setEvidenceNotes}
            multiline
          />

          <AppButton
            title="Resolve Market & Distribute Payouts"
            variant="primary"
            size="md"
            onPress={handleResolveMarket}
            disabled={!selectedWinningOption || resolving}
            loading={resolving}
            style={{
              marginTop: 24,
              backgroundColor: selectedWinningOption ? theme.success : theme.border,
              borderColor: selectedWinningOption ? theme.success : theme.border,
            }}
          />

          <AppText variant="caption" color="destructive" style={{ textAlign: 'center', marginTop: 16, marginBottom: 24 }}>
            This action cannot be undone. All participants will receive or lose
            their stakes based on this result.
          </AppText>
        </ScrollView>
      );
    }

    // Show list of open markets to resolve
    return (
      <FlatList
        data={openMarketsForResolve}
        renderItem={({ item }) => (
          <View
            style={[styles.itemContainer, {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderRadius: theme.radius.md,
            }]}
          >
            <View style={styles.itemInfo}>
              <AppText variant="title3" numberOfLines={2} style={{ marginBottom: 4 }}>
                {item.question}
              </AppText>
              <AppText variant="caption" color="secondary">
                {(item.status || "open").toUpperCase()} •{" "}
                {new Date(item.created_at || "").toLocaleDateString()} •{" "}
                {item.category || "General"}
              </AppText>
            </View>
            <AppButton
              title="Resolve"
              variant="primary"
              size="sm"
              onPress={() => handleSelectMarketToResolve(item)}
              style={{ backgroundColor: theme.success, borderColor: theme.success }}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchOpenMarketsForResolve}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons
              name="checkmark-circle-outline"
              size={48}
              color={theme.textSecondary}
            />
            <AppText variant="body" color="secondary" style={{ marginTop: 12 }}>
              No open markets to resolve
            </AppText>
          </View>
        }
      />
    );
  };

  const renderMarketItem = (
    { item, isManage = false }: { item: Market; isManage?: boolean },
  ) => (
    <View
      style={[styles.itemContainer, {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: theme.radius.md,
      }]}
    >
      <View style={styles.itemInfo}>
        <AppText variant="title3" numberOfLines={2} style={{ marginBottom: 4 }}>
          {item.question}
        </AppText>
        <AppText variant="caption" color="secondary">
          {(item.status || "open").toUpperCase()} •{" "}
          {new Date(item.created_at || "").toLocaleDateString()} •{" "}
          {item.category || "General"}
          {isManage
            ? ` • Feed: ${(item as any).public_feed_allowed ? "allowed" : "blocked"} • Review: ${(item as any).compliance_review_state || "pending"}`
            : null}
        </AppText>
      </View>

      {isManage
        ? (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(item as any).compliance_review_state !== "approved" ||
            (item as any).public_feed_allowed !== true
              ? (
                <AppButton
                  title="Approve"
                  variant="primary"
                  size="sm"
                  onPress={() => handleApproveForFeed(item.id)}
                  disabled={processingId === item.id}
                  loading={processingId === item.id}
                  style={{ backgroundColor: theme.success, borderColor: theme.success, minWidth: 72 }}
                />
              )
              : null}
            <AppButton
              title="Edit"
              variant="secondary"
              size="sm"
              onPress={() => handleEdit(item)}
              style={{ minWidth: 60 }}
            />
            <AppIconButton
              accessibilityLabel="Delete market"
              variant="default"
              onPress={() => handleDelete(item.id)}
              disabled={processingId === item.id}
              loading={processingId === item.id}
              icon={<Ionicons name="trash-outline" size={18} color={theme.onPrimary} />}
              style={{ backgroundColor: theme.destructive, borderColor: theme.destructive, width: 40, height: 40 }}
            />
          </View>
        )
        : (
          <AppButton
            title="Promote"
            variant="primary"
            size="sm"
            onPress={() => handlePromote(item.id)}
            disabled={processingId === item.id}
            loading={processingId === item.id}
          />
        )}
    </View>
  );

  const renderForm = () => (
    <ScrollView
      style={styles.formContainer}
      contentContainerStyle={[styles.formContent, { maxWidth: 600, alignSelf: 'center', width: '100%' }]}
    >
      {editingMarketId && (
        <View
          style={[styles.editBanner, {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: theme.radius.sm,
          }]}
        >
          <AppText variant="body" color="primary">Editing Market</AppText>
          <AppButton
            title="Cancel"
            variant="ghost"
            size="sm"
            onPress={() => {
              resetForm();
              setActiveTab("manage");
            }}
          />
        </View>
      )}

      <AppText variant="label" style={{ marginBottom: 8, marginTop: 16 }}>Question</AppText>
      <TextInput
        style={[styles.input, {
          backgroundColor: theme.surface,
          color: theme.text,
          borderColor: theme.border,
          borderRadius: theme.radius.sm,
        }]}
        placeholder="Will X happen by Y date?"
        placeholderTextColor={theme.textSecondary}
        value={question}
        onChangeText={setQuestion}
        multiline
      />

      <AppText variant="label" style={{ marginBottom: 8, marginTop: 16 }}>Category</AppText>
      <AppText variant="caption" color="secondary" style={{ marginTop: 12 }}>
        Sports markets are not permitted on the public feed for Ecuador launch.
      </AppText>
      <View style={styles.categoryRow}>
        {FEED_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              {
                backgroundColor: category === cat ? theme.primarySoft : theme.surface,
                borderColor: category === cat ? theme.primary : theme.border,
                borderRadius: theme.radius.pill,
              },
            ]}
            onPress={() => setCategory(cat)}
          >
            <AppText variant="body" color={category === cat ? 'primary' : 'default'}>
              {cat}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Market Type Toggle - Hide when editing */}
      {!editingMarketId && (
        <>
          <AppText variant="label" style={{ marginBottom: 8, marginTop: 16 }}>Market Type</AppText>
          <View style={styles.marketTypeRow}>
            <TouchableOpacity
              style={[
                styles.marketTypeButton,
                {
                  backgroundColor: isBinaryMarket ? theme.primary : theme.surface,
                  borderColor: isBinaryMarket ? theme.primary : theme.border,
                  borderRadius: theme.radius.md,
                },
              ]}
              onPress={() => {
                setIsBinaryMarket(true);
                setOptions(["Yes", "No"]);
              }}
            >
              <AppText variant="body" color={isBinaryMarket ? 'onPrimary' : 'default'}>
                Yes / No
              </AppText>
              <AppText variant="caption" color={isBinaryMarket ? 'onPrimary' : 'secondary'} style={{ marginTop: 2, opacity: isBinaryMarket ? 0.7 : 1 }}>
                Simple binary question
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.marketTypeButton,
                {
                  backgroundColor: !isBinaryMarket ? theme.primary : theme.surface,
                  borderColor: !isBinaryMarket ? theme.primary : theme.border,
                  borderRadius: theme.radius.md,
                },
              ]}
              onPress={() => {
                setIsBinaryMarket(false);
                if (options.length < 3) {
                  setOptions(["Option 1", "Option 2", "Option 3"]);
                }
              }}
            >
              <AppText variant="body" color={!isBinaryMarket ? 'onPrimary' : 'default'}>
                Multi-option
              </AppText>
              <AppText variant="caption" color={!isBinaryMarket ? 'onPrimary' : 'secondary'} style={{ marginTop: 2, opacity: !isBinaryMarket ? 0.7 : 1 }}>
                Multiple choices
              </AppText>
            </TouchableOpacity>
          </View>

          {/* Options - Only show for multi-option markets */}
          {!isBinaryMarket && (
            <>
              <AppText variant="label" style={{ marginBottom: 8, marginTop: 16 }}>Options</AppText>
              {options.map((opt, idx) => (
                <View key={idx} style={styles.optionRow}>
                  <TextInput
                    style={[styles.optionInput, {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                      borderRadius: theme.radius.sm,
                    }]}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={theme.textSecondary}
                    value={opt}
                    onChangeText={(val) =>
                      updateOption(idx, val)}
                  />
                  {options.length > 2 && (
                    <AppIconButton
                      accessibilityLabel={`Remove option ${idx + 1}`}
                      variant="ghost"
                      onPress={() => removeOption(idx)}
                      icon={<Ionicons name="close-circle" size={24} color={theme.textSecondary} />}
                      style={{ width: 36, height: 36, marginLeft: 8 }}
                    />
                  )}
                </View>
              ))}
              <AppButton
                title="Add Option"
                variant="secondary"
                size="sm"
                icon={<Ionicons name="add" size={20} color={theme.primary} />}
                onPress={addOption}
                style={{ borderStyle: 'dashed', marginTop: 4 }}
              />
            </>
          )}
        </>
      )}

      <AppText variant="label" style={{ marginBottom: 8, marginTop: 16 }}>Close Date</AppText>
      {Platform.OS === 'web' ? (
        <View
          style={[styles.dateButton, {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: theme.radius.sm,
          }]}
        >
          <Ionicons name="calendar-outline" size={20} color={theme.text} />
          {/* On web, render a real HTML <input type="datetime-local"> so the browser's native picker works */}
          {React.createElement('input', {
            type: 'datetime-local',
            value: (() => {
              const d = closesAt;
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })(),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const parsed = new Date(e.target.value);
              if (!isNaN(parsed.getTime())) setClosesAt(parsed);
            },
            style: {
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: theme.text,
              fontSize: getTextStyle('body').fontSize,
              marginLeft: 8,
              cursor: 'pointer',
              colorScheme: isDark ? 'dark' : 'light',
            },
          })}
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.dateButton, {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderRadius: theme.radius.sm,
            }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.text} />
            <AppText variant="body" style={{ color: theme.text }}>
              {closesAt.toLocaleDateString()} at {closesAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </AppText>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={closesAt}
              mode="datetime"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event: unknown, date?: Date) => {
                setShowDatePicker(Platform.OS === "ios");
                if (date) setClosesAt(date);
              }}
              minimumDate={new Date()}
              textColor={theme.text}
              themeVariant={isDark ? "dark" : "light"}
            />
          )}
        </>
      )}

      <AppText variant="label" style={{ marginBottom: 8, marginTop: 16 }}>Market Visual</AppText>
      <View
        style={[styles.imageManagementCard, {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
        }]}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            title="Upload Image"
            variant="primary"
            size="sm"
            icon={<Ionicons name="cloud-upload-outline" size={20} color={theme.onPrimary} />}
            onPress={pickMedia}
            disabled={uploading || isGeneratingImage}
            loading={uploading}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Generate AI"
            variant="secondary"
            size="sm"
            onPress={handleGenerateImage}
            disabled={uploading || isGeneratingImage}
            loading={isGeneratingImage}
            style={{ flex: 1, backgroundColor: theme.primarySoft, borderColor: theme.primary }}
          />
        </View>

        <TextInput
          style={[styles.input, {
            backgroundColor: theme.background,
            color: theme.text,
            borderColor: theme.border,
            borderRadius: theme.radius.sm,
            marginTop: 12,
          }]}
          placeholder="Or paste external URL..."
          placeholderTextColor={theme.textSecondary}
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <View style={styles.previewCenter}>
          <View style={[styles.phoneFrame, theme.elevation('md'), { borderRadius: theme.radius.lg, backgroundColor: theme.background, borderColor: theme.borderSubtle }]}>
            {imageUrl
              ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.fullImage}
                  contentFit="cover"
                />
              )
              : (
                <View style={[styles.emptyFrame, { borderColor: theme.borderSubtle, borderRadius: theme.radius.md }]}>
                  <Ionicons
                    name="camera-outline"
                    size={32}
                    color={theme.textSecondary}
                  />
                  <AppText variant="caption" color="secondary" style={{ marginTop: 8 }}>
                    9:16 PORTRAIT
                  </AppText>
                </View>
              )}
            <View style={[styles.frameOverlay, { backgroundColor: theme.overlay }]}>
              <AppText variant="caption" color="onPrimary" numberOfLines={2}>
                {question || "Your question..."}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="secondary" style={{ marginTop: 12 }}>
            Portrait background (Phone dimensions)
          </AppText>
          {imageUrl && (
            <AppButton
              title="Remove Media"
              variant="ghost"
              size="sm"
              onPress={() => setImageUrl("")}
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      </View>

      <AppButton
        title={editingMarketId ? "Update Market" : "Create Public Market"}
        variant="primary"
        size="md"
        onPress={handleSave}
        disabled={creating}
        loading={creating}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );

  const renderManageStatusFilter = () => {
    const filters: { id: ManageStatusFilter; label: string }[] = [
      { id: "all", label: "All" },
      { id: "open", label: "Open" },
      { id: "closed", label: "Closed" },
      { id: "resolved", label: "Resolved" },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.manageFilterRow}
      >
        {filters.map((filter) => {
          const active = manageStatusFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.manageFilterChip,
                {
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                  borderColor: active ? theme.primary : theme.border,
                  borderRadius: theme.radius.pill,
                },
              ]}
              onPress={() => setManageStatusFilter(filter.id)}
            >
              <AppText variant="body" color={active ? 'primary' : 'secondary'}>
                {filter.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <AppText variant="title2">Feed Manager (Admin)</AppText>
          <AppIconButton
            accessibilityLabel="Close feed manager"
            variant="ghost"
            onPress={onClose}
            icon={<Ionicons name="close" size={24} color={theme.text} />}
          />
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "suggestions" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("suggestions")}
          >
            <AppText variant="body" color={activeTab === "suggestions" ? 'primary' : 'secondary'}>
              Suggestions
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "promote" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("promote")}
          >
            <AppText variant="body" color={activeTab === "promote" ? 'primary' : 'secondary'}>
              Promote
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "manage" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("manage")}
          >
            <AppText variant="body" color={activeTab === "manage" ? 'primary' : 'secondary'}>
              Manage
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "resolve" &&
              { borderBottomColor: theme.success, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("resolve")}
          >
            <AppText variant="body" style={{ color: activeTab === "resolve" ? theme.success : theme.textSecondary }}>
              Resolve
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "create" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("create")}
          >
            <AppText variant="body" color={activeTab === "create" ? 'primary' : 'secondary'}>
              {editingMarketId ? "Edit" : "Create"}
            </AppText>
          </TouchableOpacity>
        </View>

        {activeTab === "create"
          ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              {renderForm()}
            </KeyboardAvoidingView>
          )
          : activeTab === "resolve"
          ? (
            renderResolveContent()
          )
          : activeTab === "suggestions"
          ? (
            renderSuggestionsContent()
          )
          : (
            <FlatList
              data={activeTab === "manage" ? filteredManageMarkets : candidates}
              renderItem={(props) =>
                renderMarketItem({
                  ...props,
                  isManage: activeTab === "manage",
                })}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshing={loading}
              onRefresh={activeTab === "manage"
                ? fetchActiveMarkets
                : fetchCandidates}
              ListHeaderComponent={activeTab === "manage"
                ? renderManageStatusFilter
                : undefined}
              ListEmptyComponent={
                <View style={styles.center}>
                  <AppText variant="body" color="secondary">
                    {activeTab === "manage"
                      ? "No public markets match this filter"
                      : "No candidates found"}
                  </AppText>
                </View>
              }
            />
          )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  manageFilterRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  manageFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  editBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    minHeight: 48,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  marketTypeRow: {
    flexDirection: "row",
    gap: 12,
  },
  marketTypeButton: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  imageManagementCard: {
    padding: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  previewCenter: {
    alignItems: "center",
    marginTop: 16,
  },
  phoneFrame: {
    width: 120,
    aspectRatio: 9 / 16,
    overflow: "hidden",
    borderWidth: 2,
    position: "relative",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  emptyFrame: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    margin: 4,
  },
  frameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    padding: 8,
    justifyContent: "flex-end",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  resolveHeader: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  resolveStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionsContainer: {
    gap: 12,
  },
  resolveOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderWidth: 2,
  },
  resolveOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
  },
  resolveOptionRight: {
    alignItems: "flex-end",
  },
  suggestionsList: {
    padding: 16,
    gap: 16,
  },
  suggestionGroup: {
    gap: 12,
  },
  suggestionCard: {
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  suggestionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
});
