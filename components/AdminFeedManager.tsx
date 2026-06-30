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
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { scanMarketTextForSports } from "../lib/compliance/sports-content";
import { supabase } from "../lib/supabase";
import { adminService } from "../services/admin.service";
import {
    FEED_CATEGORIES,
    type FeedCategory,
    type FeedMarketSuggestion,
    feedService,
} from "../services/feed.service";
import type { Market } from "../types/market";

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
  const { theme } = useTheme();
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
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No pending AI suggestions. New batches arrive at 8am, 12pm, and 3pm ET.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.suggestionsList}>
        {groupedSuggestions.map((group) => (
          <View key={group.batchId} style={styles.suggestionGroup}>
            <Text style={[styles.suggestionGroupTitle, { color: theme.text }]}>
              {group.header}
            </Text>
            {group.items.map((item) => (
              <View
                key={item.id}
                style={[styles.suggestionCard, {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }]}
              >
                <View style={styles.suggestionMetaRow}>
                  <Text style={[styles.suggestionCategory, { color: theme.primary }]}>
                    {item.category}
                  </Text>
                  <Text style={[styles.suggestionChip, { color: theme.textSecondary }]}>
                    {item.horizon === "near_term" ? "Near-term" : "Long-term"}
                  </Text>
                  <Text style={[styles.suggestionChip, { color: theme.textSecondary }]}>
                    {item.autopilot_status === "eligible"
                      ? `Autopilot eligible · ${item.autopilot_score}`
                      : `${item.autopilot_status.replace("_", " ")} · ${item.autopilot_score}`}
                  </Text>
                </View>
                <Text style={[styles.suggestionSubject, { color: theme.textSecondary }]}>
                  {item.subject}
                </Text>
                <Text style={[styles.suggestionQuestion, { color: theme.text }]}>
                  {item.question}
                </Text>
                <Text style={[styles.suggestionOptions, { color: theme.textSecondary }]}>
                  Options: {item.options.join(" · ")}
                </Text>
                <Text style={[styles.suggestionMeta, { color: theme.textSecondary }]}>
                  Closes {new Date(item.suggested_closes_at).toLocaleString()}
                </Text>
                <Text style={[styles.suggestionMeta, { color: theme.textSecondary }]}>
                  Source score {item.source_quality_score} · Resolution score {item.resolution_quality_score} · Engagement {item.engagement_score}
                </Text>
                {item.rationale ? (
                  <Text style={[styles.suggestionRationale, { color: theme.textSecondary }]}>
                    {item.rationale}
                  </Text>
                ) : null}
                {item.resolution_criteria ? (
                  <Text style={[styles.suggestionRationale, { color: theme.textSecondary }]}>
                    Resolution: {item.resolution_criteria}
                  </Text>
                ) : null}
                {item.autopilot_reasons?.length ? (
                  <Text style={[styles.suggestionSources, { color: theme.textSecondary }]}>
                    Checks: {item.autopilot_reasons.slice(0, 4).join(", ")}
                  </Text>
                ) : null}
                {item.evidence_sources?.length ? (
                  <Text style={[styles.suggestionSources, { color: theme.textSecondary }]}>
                    Evidence: {item.evidence_sources.slice(0, 3).map((source) =>
                      `${source.publisher || "Source"} (${source.source_type})`
                    ).join(", ")}
                  </Text>
                ) : null}
                {item.source_urls?.length ? (
                  <Text style={[styles.suggestionSources, { color: theme.textSecondary }]}>
                    Sources: {item.source_urls.slice(0, 3).join(", ")}
                  </Text>
                ) : null}
                <View style={styles.suggestionActions}>
                  <TouchableOpacity
                    style={[styles.suggestionActionBtn, { backgroundColor: theme.primary }]}
                    onPress={() => handleUseSuggestion(item)}
                  >
                    <Text style={styles.suggestionActionText}>Use in Create</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.suggestionActionBtn, {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderWidth: 1,
                    }]}
                    disabled={processingId === item.id}
                    onPress={() => handleDismissSuggestion(item.id)}
                  >
                    <Text style={[styles.suggestionActionText, { color: theme.text }]}>
                      Dismiss
                    </Text>
                  </TouchableOpacity>
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
            <Text
              style={{ color: theme.primary, marginLeft: 8, fontWeight: '400' }}
            >
              Back to Markets
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.resolveHeader, {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }]}
          >
            <Text style={[styles.resolveQuestion, { color: theme.text }]}>
              {resolvingMarket.question}
            </Text>
            <View style={styles.resolveStats}>
              <Text
                style={[styles.resolveStat, { color: theme.textSecondary }]}
              >
                Category: {resolvingMarket.category || "General"}
              </Text>
              <Text
                style={[styles.resolveStat, { color: theme.textSecondary }]}
              >
                Total Pool: ${totalPool.toLocaleString()}
              </Text>
            </View>
          </View>

          <Text style={[styles.label, { color: theme.text }]}>
            Select Winning Option
          </Text>
          <Text style={[styles.resolveHint, { color: theme.textSecondary }]}>
            Winners will receive proportional payouts (minus 7.95% platform fee)
          </Text>

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
                            ? "#34C75920"
                            : theme.surface,
                          borderColor: isSelected ? "#34C759" : theme.border,
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
                                ? "#34C759"
                                : theme.border,
                            },
                          ]}
                        >
                          {isSelected && (
                            <View style={styles.radioButtonInner} />
                          )}
                        </View>
                        <Text
                          style={[styles.resolveOptionLabel, {
                            color: theme.text,
                          }]}
                        >
                          {option.label}
                        </Text>
                      </View>
                      <View style={styles.resolveOptionRight}>
                        <Text
                          style={[styles.resolveOptionPool, {
                            color: theme.textSecondary,
                          }]}
                        >
                          ${option.total_pool.toLocaleString()}
                        </Text>
                        <Text
                          style={[styles.resolveOptionPercent, {
                            color: theme.primary,
                          }]}
                        >
                          {`${percentage}%`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          {/* Evidence Section */}
          <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>
            Resolution Evidence (Recommended)
          </Text>
          <Text
            style={[styles.resolveHint, {
              color: theme.textSecondary,
              marginBottom: 8,
            }]}
          >
            Add proof for transparency and dispute prevention
          </Text>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
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

          <TouchableOpacity
            style={[
              styles.resolveButton,
              {
                backgroundColor: selectedWinningOption
                  ? "#34C759"
                  : theme.border,
                opacity: resolving ? 0.7 : 1,
              },
            ]}
            onPress={handleResolveMarket}
            disabled={!selectedWinningOption || resolving}
          >
            {resolving
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={styles.resolveButtonText}>
                  Resolve Market & Distribute Payouts
                </Text>
              )}
          </TouchableOpacity>

          <Text style={[styles.warningText, { color: theme.error }]}>
            This action cannot be undone. All participants will receive or lose
            their stakes based on this result.
          </Text>
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
            }]}
          >
            <View style={styles.itemInfo}>
              <Text
                style={[styles.itemQuestion, { color: theme.text }]}
                numberOfLines={2}
              >
                {item.question}
              </Text>
              <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                {(item.status || "open").toUpperCase()} •{" "}
                {new Date(item.created_at || "").toLocaleDateString()} •{" "}
                {item.category || "General"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.promoteButton, { backgroundColor: "#34C759" }]}
              onPress={() => handleSelectMarketToResolve(item)}
            >
              <Text style={styles.promoteText}>Resolve</Text>
            </TouchableOpacity>
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
            <Text style={{ color: theme.textSecondary, marginTop: 12 }}>
              No open markets to resolve
            </Text>
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
      }]}
    >
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemQuestion, { color: theme.text }]}
          numberOfLines={2}
        >
          {item.question}
        </Text>
        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
          {(item.status || "open").toUpperCase()} •{" "}
          {new Date(item.created_at || "").toLocaleDateString()} •{" "}
          {item.category || "General"}
          {isManage
            ? ` • Feed: ${(item as any).public_feed_allowed ? "allowed" : "blocked"} • Review: ${(item as any).compliance_review_state || "pending"}`
            : null}
        </Text>
      </View>

      {isManage
        ? (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(item as any).compliance_review_state !== "approved" ||
            (item as any).public_feed_allowed !== true
              ? (
                <TouchableOpacity
                  style={[styles.promoteButton, { backgroundColor: "#34C759", minWidth: 72 }]}
                  onPress={() => handleApproveForFeed(item.id)}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.promoteText}>Approve</Text>}
                </TouchableOpacity>
              )
              : null}
            <TouchableOpacity
              style={[styles.promoteButton, {
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                minWidth: 60,
                paddingHorizontal: 12,
              }]}
              onPress={() => handleEdit(item)}
            >
              <Text style={[styles.promoteText, { color: theme.text }]}>
                Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.promoteButton, {
                backgroundColor: "#FF3B30",
                minWidth: 40,
                paddingHorizontal: 10,
              }]}
              onPress={() => handleDelete(item.id)}
              disabled={processingId === item.id}
            >
              {processingId === item.id
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="trash-outline" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        )
        : (
          <TouchableOpacity
            style={[styles.promoteButton, { backgroundColor: theme.primary }]}
            onPress={() => handlePromote(item.id)}
            disabled={processingId === item.id}
          >
            {processingId === item.id
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.promoteText}>Promote</Text>}
          </TouchableOpacity>
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
          }]}
        >
          <Text style={{ color: theme.primary, fontWeight: '400' }}>
            Editing Market
          </Text>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setActiveTab("manage");
            }}
          >
            <Text style={{ color: theme.error }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Question */}
      <Text style={[styles.label, { color: theme.text }]}>Question</Text>
      <TextInput
        style={[styles.input, {
          backgroundColor: theme.surface,
          color: theme.text,
          borderColor: theme.border,
        }]}
        placeholder="Will X happen by Y date?"
        placeholderTextColor={theme.textSecondary}
        value={question}
        onChangeText={setQuestion}
        multiline
      />

      {/* Category */}
      <Text style={[styles.label, { color: theme.text }]}>Category</Text>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        Sports markets are not permitted on the public feed for Ecuador launch.
      </Text>
      <View style={styles.categoryRow}>
        {FEED_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              {
                backgroundColor: category === cat ? theme.primarySoft : theme.surface,
                borderColor: category === cat ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={{
                color: category === cat ? theme.primary : theme.text,
                fontWeight: '400',
              }}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Market Type Toggle - Hide when editing */}
      {!editingMarketId && (
        <>
          <Text style={[styles.label, { color: theme.text }]}>Market Type</Text>
          <View style={styles.marketTypeRow}>
            <TouchableOpacity
              style={[
                styles.marketTypeButton,
                {
                  backgroundColor: isBinaryMarket
                    ? theme.primary
                    : theme.surface,
                  borderColor: isBinaryMarket ? theme.primary : theme.border,
                },
              ]}
              onPress={() => {
                setIsBinaryMarket(true);
                setOptions(["Yes", "No"]);
              }}
            >
              <Text
                style={{
                  color: isBinaryMarket ? "#fff" : theme.text,
                  fontWeight: '400',
                }}
              >
                Yes / No
              </Text>
              <Text
                style={{
                  color: isBinaryMarket
                    ? "rgba(255,255,255,0.7)"
                    : theme.textSecondary,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                Simple binary question
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.marketTypeButton,
                {
                  backgroundColor: !isBinaryMarket
                    ? theme.primary
                    : theme.surface,
                  borderColor: !isBinaryMarket ? theme.primary : theme.border,
                },
              ]}
              onPress={() => {
                setIsBinaryMarket(false);
                if (options.length < 3) {
                  setOptions(["Option 1", "Option 2", "Option 3"]);
                }
              }}
            >
              <Text
                style={{
                  color: !isBinaryMarket ? "#fff" : theme.text,
                  fontWeight: '400',
                }}
              >
                Multi-option
              </Text>
              <Text
                style={{
                  color: !isBinaryMarket
                    ? "rgba(255,255,255,0.7)"
                    : theme.textSecondary,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                Multiple choices
              </Text>
            </TouchableOpacity>
          </View>

          {/* Options - Only show for multi-option markets */}
          {!isBinaryMarket && (
            <>
              <Text style={[styles.label, { color: theme.text }]}>Options</Text>
              {options.map((opt, idx) => (
                <View key={idx} style={styles.optionRow}>
                  <TextInput
                    style={[styles.optionInput, {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={theme.textSecondary}
                    value={opt}
                    onChangeText={(val) =>
                      updateOption(idx, val)}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity
                      onPress={() => removeOption(idx)}
                      style={styles.removeBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={24}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addOptionBtn, { borderColor: theme.border }]}
                onPress={addOption}
              >
                <Ionicons name="add" size={20} color={theme.primary} />
                <Text style={{ color: theme.primary, marginLeft: 4 }}>
                  Add Option
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* Close Date */}
      <Text style={[styles.label, { color: theme.text }]}>Close Date</Text>
      {Platform.OS === 'web' ? (
        <View
          style={[styles.dateButton, {
            backgroundColor: theme.surface,
            borderColor: theme.border,
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
              fontSize: 15,
              marginLeft: 8,
              cursor: 'pointer',
              colorScheme: theme.background === '#000000' ? 'dark' : 'light',
            },
          })}
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.dateButton, {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.text} />
            <Text style={[styles.dateText, { color: theme.text }]}>
              {closesAt.toLocaleDateString()} at {closesAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
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
              themeVariant={theme.background === "#000000" ? "dark" : "light"}
            />
          )}
        </>
      )}

      {/* Image/Video Upload & Phone Preview */}
      <Text style={[styles.label, { color: theme.text }]}>Market Visual</Text>
      <View
        style={[styles.imageManagementCard, {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }]}
      >
        {/* Upload Button */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.uploadButton, {
              backgroundColor: theme.primary,
              flex: 1,
              opacity: uploading ? 0.7 : 1,
            }]}
            onPress={pickMedia}
            disabled={uploading || isGeneratingImage}
          >
            {uploading ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>Upload Image</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.uploadButton, {
              backgroundColor: "#E2B9FF20",
              borderColor: "#A855F7",
              borderWidth: 1,
              flex: 1,
              opacity: isGeneratingImage ? 0.7 : 1,
            }]}
            onPress={handleGenerateImage}
            disabled={uploading || isGeneratingImage}
          >
            {isGeneratingImage ? <ActivityIndicator color="#A855F7" size="small" /> : (
              <>
                <Text style={{ fontSize: 18 }}>✨</Text>
                <Text style={[styles.uploadButtonText, { color: "#A855F7", marginLeft: 4 }]}>Generate AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Optional URL Input for external URLs */}
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.background,
            color: theme.text,
            borderColor: theme.border,
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
          <View style={styles.phoneFrame}>
            {imageUrl
              ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.fullImage}
                  contentFit="cover"
                />
              )
              : (
                <View style={styles.emptyFrame}>
                  <Ionicons
                    name="camera-outline"
                    size={32}
                    color={theme.textSecondary}
                  />
                  <Text
                    style={{
                      color: theme.textSecondary,
                      fontSize: 10,
                      marginTop: 8,
                    }}
                  >
                    9:16 PORTRAIT
                  </Text>
                </View>
              )}
            <View style={styles.frameOverlay}>
              <Text style={styles.frameQuestion} numberOfLines={2}>
                {question || "Your question..."}
              </Text>
            </View>
          </View>
          <Text style={[styles.helperText, { color: theme.textSecondary }]}>
            Portrait background (Phone dimensions)
          </Text>
          {imageUrl && (
            <TouchableOpacity
              onPress={() => setImageUrl("")}
              style={{ marginTop: 8 }}
            >
              <Text style={{ color: theme.error, fontSize: 13 }}>
                Remove Media
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, {
          backgroundColor: theme.primary,
          opacity: creating ? 0.7 : 1,
        }]}
        onPress={handleSave}
        disabled={creating}
      >
        {creating
          ? <ActivityIndicator color="#fff" />
          : (
            <Text style={styles.createButtonText}>
              {editingMarketId ? "Update Market" : "Create Public Market"}
            </Text>
          )}
      </TouchableOpacity>
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
                },
              ]}
              onPress={() => setManageStatusFilter(filter.id)}
            >
              <Text
                style={{
                  color: active ? theme.primary : theme.textSecondary,
                  fontWeight: "400",
                }}
              >
                {filter.label}
              </Text>
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
          <Text style={[styles.title, { color: theme.text }]}>
            Feed Manager (Admin)
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
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
            <Text
              style={[styles.tabText, {
                color: activeTab === "suggestions"
                  ? theme.primary
                  : theme.textSecondary,
              }]}
            >
              Suggestions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "promote" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("promote")}
          >
            <Text
              style={[styles.tabText, {
                color: activeTab === "promote"
                  ? theme.primary
                  : theme.textSecondary,
              }]}
            >
              Promote
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "manage" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("manage")}
          >
            <Text
              style={[styles.tabText, {
                color: activeTab === "manage"
                  ? theme.primary
                  : theme.textSecondary,
              }]}
            >
              Manage
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "resolve" &&
              { borderBottomColor: "#34C759", borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("resolve")}
          >
            <Text
              style={[styles.tabText, {
                color: activeTab === "resolve"
                  ? "#34C759"
                  : theme.textSecondary,
              }]}
            >
              Resolve
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "create" &&
              { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab("create")}
          >
            <Text
              style={[styles.tabText, {
                color: activeTab === "create"
                  ? theme.primary
                  : theme.textSecondary,
              }]}
            >
              {editingMarketId ? "Edit" : "Create"}
            </Text>
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
                  <Text style={{ color: theme.textSecondary }}>
                    {activeTab === "manage"
                      ? "No public markets match this filter"
                      : "No candidates found"}
                  </Text>
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
  title: {
    fontSize: 18,
    fontWeight: '400',
  },
  closeBtn: {
    padding: 4,
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
  tabText: {
    fontSize: 15,
    fontWeight: '400',
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
    borderRadius: 999,
    borderWidth: 1,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemQuestion: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
  },
  promoteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
  },
  promoteText: {
    color: "#fff",
    fontWeight: '400',
    fontSize: 13,
  },
  // Create form styles
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
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
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
    borderRadius: 20,
    borderWidth: 1,
  },
  marketTypeRow: {
    flexDirection: "row",
    gap: 12,
  },
  marketTypeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
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
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  removeBtn: {
    marginLeft: 8,
    padding: 4,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: "dashed",
    marginTop: 4,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 16,
  },
  createButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: '400',
  },
  imageManagementCard: {
    padding: 16,
    borderRadius: 16,
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
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#333",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
    borderColor: "#444",
    margin: 4,
    borderRadius: 12,
  },
  frameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    justifyContent: "flex-end",
  },
  frameQuestion: {
    color: "#fff",
    fontSize: 8,
    fontWeight: '400',
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: '400',
  },
  helperText: {
    fontSize: 11,
    marginTop: 12,
    fontWeight: "400",
  },
  // Resolve styles
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  resolveHeader: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  resolveQuestion: {
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 12,
  },
  resolveStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resolveStat: {
    fontSize: 13,
  },
  resolveHint: {
    fontSize: 13,
    marginBottom: 16,
    marginLeft: 4,
  },
  optionsContainer: {
    gap: 12,
  },
  resolveOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
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
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34C759",
  },
  resolveOptionLabel: {
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
  },
  resolveOptionRight: {
    alignItems: "flex-end",
  },
  resolveOptionPool: {
    fontSize: 14,
    fontWeight: '400',
  },
  resolveOptionPercent: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  resolveButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  resolveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: '400',
  },
  warningText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  suggestionsList: {
    padding: 16,
    gap: 16,
  },
  suggestionGroup: {
    gap: 12,
  },
  suggestionGroupTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  suggestionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionCategory: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  suggestionChip: {
    fontSize: 12,
  },
  suggestionSubject: {
    fontSize: 13,
  },
  suggestionQuestion: {
    fontSize: 16,
    fontWeight: "500",
  },
  suggestionOptions: {
    fontSize: 13,
  },
  suggestionMeta: {
    fontSize: 12,
  },
  suggestionRationale: {
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionSources: {
    fontSize: 11,
    lineHeight: 16,
  },
  suggestionActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  suggestionActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  suggestionActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
});
