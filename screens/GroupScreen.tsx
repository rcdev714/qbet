import { AppText, ErrorBanner } from "@/components/ui";
import { Brand } from "@/constants/theme";
import { logger } from "@/lib/logger";
import DateTimePicker from "@react-native-community/datetimepicker";
import { decode } from "base64-arraybuffer";
import * as Clipboard from 'expo-clipboard';
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { shareService } from "@/services/share.service";
import { useTranslation } from "react-i18next";
import { AnyMarketLoader } from "../components/AnyMarketLoader";
import { GlobalHeader } from "../components/GlobalHeader";
import { ActiveBetsTab } from "../components/group-chat/ActiveBetsTab";
import { ChatTab } from "../components/group-chat/ChatTab";
import type { GroupTab } from "../components/group-chat/GroupTabBar";
import { GroupTabBar } from "../components/group-chat/GroupTabBar";
import { HistoryTab } from "../components/group-chat/HistoryTab";
import { RankingsTab } from "../components/group-chat/RankingsTab";
import { GroupInfoModal } from "../components/GroupInfoModal";
import { PlayModeToggle } from "../components/PlayModeToggle";
import { PublicBetPickerModal } from "../components/PublicBetPickerModal";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppLocale } from "../contexts/LocaleContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { useGroup, useGroupMembers } from "../hooks/useGroups";
import { useGroupMarkets } from "../hooks/useMarket";
import { useMessages } from "../hooks/useMessages";
import { usePremiumNavigation } from "../hooks/usePremiumNavigation";
import { alertBetPlacedWithContract } from "../lib/bet-contract-ui";
import { getSportsBlockMessage, scanMarketTextForSports } from "../lib/compliance/sports-content";
import { formatCurrency } from "../lib/parimutuel";
import { getParamString } from "../lib/route-params";
import { supabase } from "../lib/supabase";
import { betService } from "../services/bet.service";
import { complianceService } from "../services/compliance.service";
import { groupService } from "../services/group.service";
import { marketService } from "../services/market.service";
import type { Market, MarketOption } from "../types/market";
import type { Message } from "../types/message";

function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function GroupScreen() {
  const router = useRouter();
  const { t } = useTranslation("group");
  const { locale } = useAppLocale();
  const { navigate } = usePremiumNavigation();
  const params = useLocalSearchParams<{ id: string; onboarding?: string }>();
  const groupId = getParamString(params.id) ?? null;
  const onboarding = getParamString(params.onboarding);
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const { balance, isPlayMode, refresh: refreshWallet, lastBetTime } = useWalletContext();
  const { group, loading: groupLoading } = useGroup(groupId);
  const { members, promoteToAdmin, removeMember } = useGroupMembers(groupId);
  const { messages, sendMessage, addOptimisticMessage, updateOptimisticMessage, removeOptimisticMessage } = useMessages(groupId);
  const { markets, loading: marketsLoading, refresh: refreshMarkets } = useGroupMarkets(groupId);


    // Removed parseDateString


  // ─── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<GroupTab>("chat");

  // ─── Shared state ────────────────────────────────────────────────────────
  const [marketRefreshTrigger, setMarketRefreshTrigger] = useState(0);
  const [inputText, setInputText] = useState("");
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isAttachMenuVisible, setAttachMenuVisible] = useState(false);
  const [isPublicBetPickerVisible, setPublicBetPickerVisible] = useState(false);
  const [isMembersModalVisible, setMembersModalVisible] = useState(false); // Can be removed if GroupInfo replaces it, or kept for specific member management
  const [isGroupInfoVisible, setGroupInfoVisible] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedName, setEditedName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [closesAt, setClosesAt] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [initialBetAmount, setInitialBetAmount] = useState("");
  const [selectedInitialOption, setSelectedInitialOption] = useState<number | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [marketImage, setMarketImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);

  // Bet modal state
  const [betModalVisible, setBetModalVisible] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const isAdmin = members.find((m: any) => m.user_id === user?.id)?.role === "admin";
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [openExpanded, setOpenExpanded] = useState(false);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const [hasOpenedFirstBetOnboarding, setHasOpenedFirstBetOnboarding] = useState(false);

  const openMarkets = markets.filter((m: any) => m.status === "open");
  const closedMarkets = markets.filter((m: any) => m.status !== "open");
  const isFirstBetOnboarding = onboarding === "first-bet";

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    refreshMarkets();
  }, [lastBetTime, isPlayMode]);

  useEffect(() => {
    let cancelled = false;
    const loadShareCode = async () => {
      if (!isAdmin || !groupId) { setShareCode(null); return; }
      const { shareCode: code } = await groupService.getGroupShareCode(groupId);
      if (!cancelled) setShareCode(code ?? null);
    };
    loadShareCode();
    return () => { cancelled = true; };
  }, [groupId, isAdmin]);

  useEffect(() => {
    if (group?.description) setEditedDescription(group.description);
    if (group?.name) setEditedName(group.name);
  }, [group]);

  useEffect(() => {
    if (!isFirstBetOnboarding || hasOpenedFirstBetOnboarding || groupLoading) return;
    if (group && isAdmin) {
      setNewOptions(["Yes", "No"]);
      setSelectedInitialOption(0);
      if (balance >= 10) {
        setInitialBetAmount("10");
      } else if (balance >= 1) {
        setInitialBetAmount(String(Math.floor(balance)));
      }
      setCreateModalVisible(true);
      setHasOpenedFirstBetOnboarding(true);
    }
  }, [balance, group, groupLoading, hasOpenedFirstBetOnboarding, isAdmin, isFirstBetOnboarding]);

  useEffect(() => {
    if (!statusBanner) return;
    const timeout = setTimeout(() => setStatusBanner(null), 3500);
    return () => clearTimeout(timeout);
  }, [statusBanner]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleUpdateDescription = async () => {
    if (!group || !isAdmin) return;
    try {
      const { error } = await groupService.updateGroup(group.id, { description: editedDescription });
      if (error) throw error;
      setStatusBanner("Group description updated.");
    } catch (error: any) {
      Alert.alert("Couldn't update description", `${error.message || "Something went wrong."} Try saving again.`);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!group || !isAdmin || !editedName.trim()) return;
    try {
      const { error } = await groupService.updateGroup(group.id, { name: editedName });
      if (error) throw error;
      setStatusBanner("Group name updated.");
    } catch (error: any) {
      Alert.alert("Couldn't update group name", `${error.message || "Something went wrong."} Try saving again.`);
    }
  };

  const pickGroupImage = async () => {
    if (!isAdmin) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) uploadGroupImage(result.assets[0]);
    } catch (error: any) {
      Alert.alert("Error picking image", error.message);
    }
  };

  const uploadGroupImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user || !groupId || !isAdmin) return;
    try {
      setIsUploadingGroupAvatar(true);
      if (!asset.base64) throw new Error("No image data found");
      const arrayBuffer = decode(asset.base64);
      const uriPath = asset.uri.split(/[?#]/)[0];
      const lastDot = uriPath.lastIndexOf(".");
      const ext = lastDot !== -1 ? uriPath.substring(lastDot + 1) : "jpg";
      const fileName = `group-avatars/${groupId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, arrayBuffer, { contentType: asset.mimeType ?? "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const { error } = await groupService.updateGroup(groupId, { avatar_url: publicUrl });
      if (error) throw error;
      setStatusBanner("Group photo updated.");
    } catch (error: any) {
      Alert.alert("Error uploading image", error.message);
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  };

  const handleRemoveMember = (memberUserId: string) => {
    if (!isAdmin || !user || memberUserId === user.id) return;
    Alert.alert("Remove member from group?", "They'll lose access to this group and its chat. You can invite them again later.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove member", style: "destructive", onPress: async () => { const { error } = await removeMember(memberUserId); if (error) Alert.alert("Couldn't remove member", `${error.message} Try again.`); } },
    ]);
  };

  const handleDeleteGroup = () => {
    if (!isAdmin || !group) return;
    Alert.alert("Delete group permanently?", "This deletes the group, its predictions, and messages for everyone. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete group", style: "destructive", onPress: async () => {
        const { error } = await groupService.deleteGroup(group.id);
        if (error) { Alert.alert("Couldn't delete group", `${error.message} Try again or contact support.`); return; }
        setMembersModalVisible(false);
        router.replace("/" as any);
      }},
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();
    const { error } = await sendMessage({ user_id: user.id, content: text, message_type: "text" });
    if (error) { Alert.alert("Message wasn't sent", "Your text is back in the composer. Check your connection and try again."); setInputText(text); }
  };

  const handleAttachPress = () => {
    Keyboard.dismiss();
    if (Platform.OS === "web") {
      setAttachMenuVisible(true);
      return;
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Invite", "Create prediction", "Share public bet", "Send image"], cancelButtonIndex: 0 },
        (buttonIndex: number) => {
          if (buttonIndex === 1) handleCopyInviteCode();
          else if (buttonIndex === 2) setCreateModalVisible(true);
          else if (buttonIndex === 3) setPublicBetPickerVisible(true);
          else if (buttonIndex === 4) pickChatImage();
        },
      );
    } else {
      Alert.alert("Group actions", "", [
        { text: "Cancel", style: "cancel" },
        { text: "Invite", onPress: handleCopyInviteCode },
        { text: "Create prediction", onPress: () => setCreateModalVisible(true) },
        { text: "Share public bet", onPress: () => setPublicBetPickerVisible(true) },
        { text: "Send image", onPress: () => pickChatImage() },
      ]);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!group || !shareCode) {
      Alert.alert("Invite code unavailable", "Open group info again or refresh this group, then try copying the invite code.");
      setAttachMenuVisible(false);
      return;
    }
    if (shareCode) {
      const groupName = group.name || "this group";
      const shareUrl = shareService.getGroupInviteShareUrl(group.id, shareCode);
      const title = groupName;
      const message = `Join ${groupName} with invite code ${shareCode}.`;

      await Clipboard.setStringAsync(shareUrl);

      try {
        await Share.share(
          Platform.OS === "ios"
            ? { message, url: shareUrl }
            : { message: `${message}\n\n${shareUrl}`, title },
          {
            dialogTitle: "Share group invite",
            subject: title,
          },
        );
        setStatusBanner("Invite link shared.");
      } catch (error) {
        logger.error("Error sharing invite link", { groupId: group?.id }, error);
        setStatusBanner("Invite link copied.");
      }
    } else {
      Alert.alert("Invite code unavailable", "Open group info again or refresh this group, then try copying the invite code.");
    }
    setAttachMenuVisible(false);
  };

  const pickChatImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
      if (!result.canceled && result.assets?.[0]) uploadChatImage(result.assets[0]);
    } catch (error: any) {
      Alert.alert("Error picking image", error.message);
    }
  };

  const uploadChatImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user || !groupId) return;
    try {
      setIsUploadingImage(true);
      if (!asset.base64) throw new Error("No image data found");
      const arrayBuffer = decode(asset.base64);
      const ext = asset.uri.substring(asset.uri.lastIndexOf(".") + 1);
      const fileName = `${groupId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("market-images").upload(fileName, arrayBuffer, { contentType: asset.mimeType ?? "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("market-images").getPublicUrl(fileName);
      const { error } = await sendMessage({ user_id: user.id, content: publicUrl, message_type: "image" });
      if (error) throw error;
    } catch (error: any) {
      Alert.alert("Error uploading image", error.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const pickMarketImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.5, base64: true });
    if (!result.canceled) setMarketImage(result.assets[0]);
  };

  const handleCreateMarket = async () => {
    const filteredOptions = newOptions.filter((opt: string) => opt.trim() !== "");
    if (!newQuestion.trim() || filteredOptions.length < 2) {
      Alert.alert(t("addQuestionOptions"), t("addQuestionOptionsBody"));
      return;
    }
    if (!user) {
      Alert.alert(t("signInRequired"), t("signInRequiredBody"));
      return;
    }
    if (!group) return;
    const createGroupId = group.id;

    try {
      const residence = await complianceService.getUserResidence();
      if (residence?.jurisdiction === "EC") {
        const sportsScan = scanMarketTextForSports({
          question: newQuestion,
          optionLabels: filteredOptions,
        });
        if (sportsScan.blocked) {
          Alert.alert(
            t("sportsBlockedTitle"),
            getSportsBlockMessage(locale),
          );
          return;
        }
      }
    } catch {
      // Continue; server gate is authoritative.
    }

    const marketClosesAt = closesAt;
    
    // Web date validation
    if (Platform.OS === 'web') {
      if (marketClosesAt <= new Date()) {
        Alert.alert("Choose a future close date", "Predictions need a close time after the current time.");
        return;
      }
    }

    const tempId = `temp_market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const optimisticMessage: Message = {
      id: tempId, group_id: createGroupId, user_id: user.id,
      content: `New Market: ${newQuestion}`, message_type: "market",
      market_id: tempId, created_at: now, status: "sending",
    };

    setCreateModalVisible(false);
    Keyboard.dismiss();
    addOptimisticMessage(optimisticMessage);
    // Switch to chat tab so user can see the optimistic message
    setActiveTab("chat");

    setCreateLoading(true);
    try {
      let imageUrl: string | undefined;
      if (marketImage?.base64) {
        try {
          const timestamp = Date.now();
          const fileName = `${createGroupId}/${timestamp}.jpg`;
          const arrayBuffer = decode(marketImage.base64);
          const { error: uploadError } = await supabase.storage.from("market-images").upload(fileName, arrayBuffer, { contentType: marketImage.mimeType ?? "image/jpeg", upsert: false });
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from("market-images").getPublicUrl(fileName);
          imageUrl = publicUrl;
        } catch (e) {
          logger.error("Image upload failed during market creation", { groupId: createGroupId }, e);
        }
      }

      const { market, error } = await marketService.createMarket({ groupId: createGroupId, question: newQuestion, options: filteredOptions, closesAt: marketClosesAt, imageUrl });
      if (error) throw error;

      if (market) {
        updateOptimisticMessage(tempId, { market_id: market.id, status: "sent" });
        setTimeout(() => updateOptimisticMessage(tempId, { status: "delivered" }), 500);
      }

      if (market && initialBetAmount && selectedInitialOption !== null) {
        const amount = parseFloat(initialBetAmount);
        if (!isNaN(amount) && amount > 0) {
          if (amount > balance) {
            setStatusBanner("Prediction created. Initial bet skipped because your balance is too low.");
          } else {
            const options = await marketService.getMarketOptions(market.id);
            const optionToBet = options?.find((o: MarketOption) => o.label === filteredOptions[selectedInitialOption]);
            if (optionToBet) {
              const { bet, error: betError, contractPipeline } = await betService.placeBet({ marketId: market.id, optionId: optionToBet.id, amount, isPlayMode });
              if (betError) setStatusBanner(`Prediction created. Initial bet failed: ${betError.message}`);
              else {
                refreshWallet();
                setStatusBanner("Prediction created and initial bet placed.");
                alertBetPlacedWithContract({
                  router,
                  betId: bet?.id,
                  isPlayMode,
                  contractPipeline,
                });
              }
            }
          }
        }
      }

      setNewQuestion(""); setNewOptions(["", ""]); setClosesAt(new Date(Date.now() + 24 * 60 * 60 * 1000));
      setInitialBetAmount(""); setSelectedInitialOption(null); setMarketImage(null);
    } catch (error) {
      removeOptimisticMessage(tempId);
      const errorMessage = actionErrorMessage(error, "Something went wrong while creating the prediction.");
      Alert.alert("Prediction wasn't created", `${errorMessage} Review the details and try again.`);
      setCreateModalVisible(true);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResolveMarket = async (marketId: string, optionId: string) => {
    Alert.alert("Resolve this prediction?", "This sets the winning outcome and distributes payouts immediately. Review the result before confirming.", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm Result", onPress: async () => {
        try {
          const { error } = await marketService.resolveMarket(marketId, optionId);
          if (error) throw error;
          setStatusBanner("Market resolved and payouts distributed.");
        } catch (err) {
          Alert.alert("Couldn't resolve prediction", `${actionErrorMessage(err, "Something went wrong.")} Try again.`);
        }
      }},
    ]);
  };

  const handleOpenBet = (market: Market, optionId: string, side: "yes" | "no") => {
    Keyboard.dismiss();
    setSelectedMarket(market);
    setSelectedOptionId(optionId);
    setSelectedSide(side);
    setBetModalVisible(true);
  };

  const handlePlaceBet = async () => {
    if (!selectedMarket || !selectedOptionId || !selectedSide || !betAmount || !user) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert("Enter a valid amount", "Use a number greater than 0 before placing this prediction."); return; }
    if (amount > balance) { Alert.alert("Balance too low", "Add funds or switch to Practice mode, then try again."); return; }

    Keyboard.dismiss();
    setIsPlacingBet(true);
    const { bet, error, contractPipeline } = await betService.placeBet({ marketId: selectedMarket.id, optionId: selectedOptionId, amount, side: selectedSide, isPlayMode });
    setIsPlacingBet(false);

    if (error) {
      Alert.alert("Prediction wasn't placed", `${error.message} Try again or choose a smaller amount.`);
    } else {
      setBetModalVisible(false);
      setBetAmount("");
      setSelectedSide(null);
      refreshWallet();
      refreshMarkets();
      setMarketRefreshTrigger((prev: number) => prev + 1);
      setStatusBanner("Prediction placed.");
      alertBetPlacedWithContract({
        router,
        betId: bet?.id,
        isPlayMode,
        contractPipeline,
      });
    }
  };

  const addOption = () => setNewOptions([...newOptions, ""]);
  const updateOption = (text: string, index: number) => { const updated = [...newOptions]; updated[index] = text; setNewOptions(updated); };
  const removeOption = (index: number) => {
    if (newOptions.length > 2) {
      const updated = newOptions.filter((_: string, i: number) => i !== index);
      setNewOptions(updated);
      if (selectedInitialOption === index) setSelectedInitialOption(null);
      else if (selectedInitialOption !== null && selectedInitialOption > index) setSelectedInitialOption(selectedInitialOption - 1);
    }
  };

  const formatClosesAt = (iso: string | null) => {
    if (!iso) return "No close time";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "No close time";
    return d.toLocaleString();
  };

  // ─── Loading state ───────────────────────────────────────────────────────
  if (groupLoading) {
    return <AnyMarketLoader message="Opening your group..." />;
  }

  if (!groupId || !group) {
    return (
      <SafeAreaView style={[styles.container, styles.centeredFallback, { backgroundColor: theme.background }]}>
        <Text style={[styles.fallbackTitle, { color: theme.text }]}>Group not found</Text>
        <Text style={[styles.fallbackBody, { color: theme.textSecondary }]}>
          This group may have been deleted or you may not have access.
        </Text>
        <TouchableOpacity style={[styles.fallbackButton, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
          <Text style={[styles.fallbackButtonText, { color: theme.onPrimary }]}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activeGroupId = group.id;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <GlobalHeader
        ignoreTopInset
        left={
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.backButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
          >
            <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
          </TouchableOpacity>
        }
        center={
          <TouchableOpacity 
            style={[styles.headerInfo, { flexDirection: 'row', alignItems: 'center' }, Platform.OS === "web" && ({ cursor: "pointer" } as any)]} 
            onPress={() => setGroupInfoVisible(true)}
            activeOpacity={0.7}
          >
            {group?.avatar_url ? (
              <Image source={{ uri: group.avatar_url }} style={styles.groupHeaderAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.groupHeaderAvatarPlaceholder, { backgroundColor: theme.primary + "20" }]}>
                <Text style={[styles.groupHeaderAvatarInitials, { color: theme.primary }]}>{group?.name?.[0]?.toUpperCase() || "G"}</Text>
              </View>
            )}
            <View style={{ marginLeft: 8, alignItems: 'center' }}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{group?.name || "Group"}</Text>
              <Text style={styles.headerSubtitle}>Tap for Info</Text>
            </View>
          </TouchableOpacity>
        }
        right={
          <View style={styles.headerActions}>
            <PlayModeToggle compact />
            <TouchableOpacity 
              style={[styles.headerCreateAction, { backgroundColor: theme.primary }, Platform.OS === "web" && ({ cursor: "pointer" } as any)]} 
              onPress={() => setCreateModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Create prediction"
              activeOpacity={0.85}
            >
              <IconSymbol name="plus" size={18} color={theme.onPrimary} />
              <Text style={[styles.headerCreateActionText, { color: theme.onPrimary }]}>Create prediction</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerInfoAction, { borderColor: theme.border, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F7F8FA" }, Platform.OS === "web" && ({ cursor: "pointer" } as any)]} 
              onPress={() => setGroupInfoVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Group info"
              activeOpacity={0.8}
            >
              <IconSymbol name="info.circle" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {statusBanner && (
        <View style={[styles.statusBanner, { backgroundColor: isDark ? "rgba(52,199,89,0.18)" : "#EAF8EF", borderColor: isDark ? "rgba(52,199,89,0.35)" : "#BFE8CC" }]}>
          <IconSymbol name="checkmark" size={16} color={theme.primary} />
          <Text style={[styles.statusBannerText, { color: theme.text }]}>{statusBanner}</Text>
        </View>
      )}

      {/* ── Tab Bar ─────────────────────────────────────────────────── */}
      <GroupTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        openCount={openMarkets.length}
      />

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <ChatTab
          messages={messages}
          messagesLoading={false}
          currentUser={user}
          router={router}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          marketRefreshTrigger={marketRefreshTrigger}
          inputText={inputText}
          setInputText={setInputText}
          onSendMessage={handleSendMessage}
          onAttachPress={handleAttachPress}
          isUploadingImage={isUploadingImage}
          onBet={handleOpenBet}
          onResolve={handleResolveMarket}
        />
      )}

      {activeTab === "active" && (
        <ActiveBetsTab
          markets={openMarkets}
          loading={marketsLoading}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          onBet={handleOpenBet}
          onResolve={handleResolveMarket}
          onRefresh={refreshMarkets}
          refreshTrigger={marketRefreshTrigger}
        />
      )}

      {activeTab === "history" && (
        <HistoryTab
          markets={closedMarkets}
          loading={marketsLoading}
          onRefresh={refreshMarkets}
        />
      )}

      {activeTab === "rankings" && (
        <RankingsTab
          groupId={activeGroupId}
          members={members}
          markets={markets}
          currentUserId={user?.id}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODALS — kept here because they interact with top-level state
         ═══════════════════════════════════════════════════════════════ */}

      <GroupInfoModal 
        visible={isGroupInfoVisible}
        onClose={() => setGroupInfoVisible(false)}
        group={group}
        memberCount={members?.length || 0}
        isAdmin={isAdmin}
        onEditImage={pickGroupImage}
        onEditName={() => { setGroupInfoVisible(false); Alert.prompt("Edit Group Name", undefined, (text) => { if (text) { setEditedName(text); handleUpdateGroupName(); } }, "plain-text", group?.name || ""); }} 
        onEditDescription={() => { setGroupInfoVisible(false); Alert.prompt("Edit Group Description", undefined, (text) => { if (text) { setEditedDescription(text); handleUpdateDescription(); } }, "plain-text", group?.description || ""); }}
        onInvite={() => { setGroupInfoVisible(false); setTimeout(() => handleAttachPress(), 200); }} 
        onLeave={() => { if (user?.id) handleRemoveMember(user.id); }}
        onDelete={handleDeleteGroup}
        shareCode={shareCode}
      />

      {/* ── Attach Menu Modal (Web/General) ─────────────────────────── */}
      <Modal visible={isAttachMenuVisible} transparent animationType="fade" onRequestClose={() => setAttachMenuVisible(false)}>
        <TouchableOpacity 
          style={[styles.modalOverlay, { justifyContent: "center", alignItems: "center" }]} 
          activeOpacity={1} 
          onPress={() => setAttachMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()} style={[styles.attachMenuContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.attachMenuTitle, { color: theme.textSecondary }]}>Group actions</Text>
            
            <TouchableOpacity 
               style={[styles.attachMenuItem, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
               onPress={handleCopyInviteCode}
            >
              <IconSymbol name="list.bullet" size={20} color={theme.primary} />
              <Text style={[styles.attachMenuItemText, { color: theme.text }]}>Invite</Text>
            </TouchableOpacity>

            <TouchableOpacity 
               style={[styles.attachMenuItem, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
               onPress={() => { setAttachMenuVisible(false); pickChatImage(); }}
            >
              <IconSymbol name="photo.fill" size={20} color={theme.primary} />
              <Text style={[styles.attachMenuItemText, { color: theme.text }]}>Send image</Text>
            </TouchableOpacity>

            <TouchableOpacity 
               style={[styles.attachMenuItem, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
               onPress={() => { setAttachMenuVisible(false); setCreateModalVisible(true); }}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={theme.primary} />
              <Text style={[styles.attachMenuItemText, { color: theme.text }]}>Create prediction</Text>
            </TouchableOpacity>

            <TouchableOpacity 
               style={[styles.attachMenuItem, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
               onPress={() => { setAttachMenuVisible(false); setPublicBetPickerVisible(true); }}
            >
              <IconSymbol name="arrow.up.right.circle.fill" size={20} color={theme.primary} />
              <Text style={[styles.attachMenuItemText, { color: theme.text }]}>Share public bet</Text>
            </TouchableOpacity>

            <TouchableOpacity 
               style={[styles.attachMenuItem, { borderBottomWidth: 0, marginTop: 8, justifyContent: 'center' }, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
               onPress={() => setAttachMenuVisible(false)}
            >
              <Text style={[styles.attachMenuItemText, { color: '#FF3B30', fontWeight: '600', marginLeft: 0 }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Prediction Modal ────────────────────────────────── */}
      <Modal visible={isCreateModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setCreateModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.modalKeyboardAvoiding}
            pointerEvents="box-none"
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()} 
              style={[styles.modalContent, { maxHeight: "90%", backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
                <TouchableOpacity 
                  onPress={() => setCreateModalVisible(false)} 
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Create Prediction</Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.modalCloseButton}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                <View style={{ gap: 20 }}>
                  {isFirstBetOnboarding && (
                    <View style={[styles.firstBetGuideCard, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}45` }]}>
                      <View style={styles.firstBetGuideHeader}>
                        <View style={[styles.firstBetGuideIcon, { backgroundColor: `${theme.primary}22` }]}>
                          <IconSymbol name="sparkles" size={18} color={theme.primary} />
                        </View>
                        <Text style={[styles.firstBetGuideLabel, { color: theme.primary }]}>STEP 2 OF 2</Text>
                      </View>
                      <AppText variant="title1" style={styles.firstBetGuideTitle}>Create your first group bet</AppText>
                      <Text style={[styles.firstBetGuideBody, { color: theme.textSecondary }]}>
                        Ask a simple yes/no question, keep the starter outcomes, then launch it. We preselected a small first bet when your balance allows it.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={pickMarketImage}
                    style={[styles.imagePickerButton, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderWidth: 1, borderColor: theme.border, height: 160, borderRadius: 20 }]}
                  >
                    {marketImage ? (
                      <Image source={{ uri: marketImage.uri }} style={styles.selectedImage} contentFit="cover" />
                    ) : (
                      <View style={styles.imagePickerPlaceholder}>
                        <IconSymbol name="photo.fill" size={32} color={theme.primary} />
                        <Text style={[styles.imagePickerText, { color: theme.primary, marginTop: 8 }]}>Add Cover Image</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.modalSection}>
                    <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>What are you predicting?</AppText>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", color: theme.text, height: undefined, minHeight: 60, paddingTop: 12, paddingBottom: 12, borderRadius: 16, textAlignVertical: "top" }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
                      placeholder="e.g. Will bitcoin hit $100k by 2026?"
                      placeholderTextColor={theme.textSecondary}
                      value={newQuestion}
                      onChangeText={setNewQuestion}
                      multiline
                    />
                  </View>

                  <View style={styles.modalSection}>
                    <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Available Outcomes</AppText>
                    {newOptions.map((item, index) => (
                      <View 
                        key={index} 
                        style={[styles.optionInputRow, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderColor: selectedInitialOption === index ? theme.primary : "transparent", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center" }]}
                      >
                        <TouchableOpacity
                          style={[styles.optionCheck, { borderColor: theme.border, borderWidth: 2, borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }, selectedInitialOption === index && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                          onPress={() => setSelectedInitialOption(index)}
                        >
                          {selectedInitialOption === index && <IconSymbol name="checkmark" size={14} color="#FFF" />}
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.optionInput, { color: theme.text, flex: 1, marginLeft: 10, height: 40 }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
                          placeholder={`Outcome ${index + 1}`}
                          placeholderTextColor={theme.textSecondary}
                          value={item}
                          onChangeText={(text: string) => updateOption(text, index)}
                        />
                        {newOptions.length > 2 && (
                          <TouchableOpacity onPress={() => removeOption(index)} style={{ padding: 8 }}>
                            <IconSymbol name="minus.circle.fill" size={20} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </View>

                <View style={{ gap: 24, marginTop: 10 }}>
                  <TouchableOpacity style={[styles.addOptionBtn, { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: theme.primary }]} onPress={addOption}>
                    <IconSymbol name="plus.circle.fill" size={20} color={theme.primary} />
                    <Text style={[styles.addOptionBtnText, { color: theme.primary, marginLeft: 8 }]}>Add another outcome</Text>
                  </TouchableOpacity>

                  <View style={styles.modalSection}>
                    <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Closing Date</AppText>
                    {Platform.OS === "web" ? (
                      <View style={[styles.dateButton, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 12, height: 60, justifyContent: "center" }]}>
                        {React.createElement('input', {
                          type: 'datetime-local',
                          value: new Date(closesAt.getTime() - (closesAt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
                          onChange: (e: any) => {
                            const date = new Date(e.target.value);
                            if (!isNaN(date.getTime())) {
                              setClosesAt(date);
                            }
                          },
                          style: {
                            fontSize: 16,
                            color: theme.text,
                            height: '100%',
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontFamily: 'System',
                          }
                        })}
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity style={[styles.dateButton, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]} onPress={() => setShowDatePicker(true)}>
                          <Text style={[styles.dateText, { color: theme.text, fontWeight: "600" }]}>{closesAt.toLocaleDateString()} at {closesAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                          <IconSymbol name="calendar" size={20} color={theme.primary} />
                        </TouchableOpacity>
                        {showDatePicker && (
                          <DateTimePicker value={closesAt} mode="datetime" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_event: any, date?: Date) => { setShowDatePicker(Platform.OS === "ios"); if (date) setClosesAt(date); }} minimumDate={new Date()} textColor={isDark ? "#FFFFFF" : "#000000"} />
                        )}
                      </>
                    )}
                  </View>

                  <View style={styles.modalSection}>
                    <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Initial Prediction Amount (Optional)</AppText>
                    <View style={[styles.initialBetInputRow, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: theme.border }]}>
                      <Text style={[styles.currencyPrefix, { color: theme.text, fontSize: 18, fontWeight: "600" }]}>$</Text>
                      <TextInput
                        style={[styles.initialBetInput, { color: theme.text, flex: 1, marginLeft: 8, fontSize: 18, fontWeight: "600" }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
                        placeholder="0.00" placeholderTextColor={theme.textSecondary}
                        value={initialBetAmount} onChangeText={setInitialBetAmount} keyboardType="numeric"
                      />
                    </View>
                    {selectedInitialOption === null && initialBetAmount !== "" && (
                      <ErrorBanner message="Select one above outcome to place this initial amount" />
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: theme.primary, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 10 }, createLoading && { opacity: 0.5 }]}
                    onPress={handleCreateMarket} disabled={createLoading}
                  >
                    {createLoading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={[styles.createButtonText, { color: theme.onPrimary, fontSize: 17, fontWeight: "600" }]}>Launch Now</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <PublicBetPickerModal
        visible={isPublicBetPickerVisible}
        onClose={() => setPublicBetPickerVisible(false)}
        onSelect={async (market) => {
          setPublicBetPickerVisible(false);
          shareService.trackShare(market.id, "market", "internal").catch((error) => {
            logger.error("Failed to track share", { marketId: market.id }, error);
          });
          await sendMessage({
             user_id: user!.id,
             content: `Shared a public prediction: ${market.question}`,
             message_type: "shared_market",
             market_id: market.id
          });
          setStatusBanner("Public prediction shared.");
        }}
      />

      {/* ── Group Info / Members Modal ─────────────────────────────── */}
      <Modal visible={isMembersModalVisible} transparent animationType="slide" onRequestClose={() => setMembersModalVisible(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setMembersModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.modalKeyboardAvoiding}
            pointerEvents="box-none"
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()} 
              style={[styles.modalContent, { flex: 1, maxHeight: "90%", backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "600", color: theme.text }}>{group?.name}</Text>
                <TouchableOpacity onPress={() => setGroupInfoVisible(true)}>
                   <IconSymbol name="info.circle" size={24} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMembersModalVisible(false)} style={styles.modalCloseButton}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <FlatList
                ListHeaderComponent={
                  <>
                    <View style={styles.modalGroupAvatarContainer}>
                      <TouchableOpacity onPress={pickGroupImage} disabled={!isAdmin || isUploadingGroupAvatar}>
                        {group?.avatar_url ? (
                          <Image source={{ uri: group.avatar_url }} style={styles.modalGroupAvatar} contentFit="cover" />
                        ) : (
                          <View style={[styles.modalGroupAvatarPlaceholder, { backgroundColor: theme.primary + "20" }]}>
                            <Text style={[styles.modalGroupAvatarInitials, { color: theme.primary }]}>{group?.name?.[0]?.toUpperCase() || "G"}</Text>
                          </View>
                        )}
                        {isUploadingGroupAvatar && (
                          <View style={styles.uploadProgressOverlay}><ActivityIndicator color="#fff" /></View>
                        )}
                        {isAdmin && !isUploadingGroupAvatar && (
                          <View style={[styles.uploadProgressOverlay, { backgroundColor: "transparent" }]}>
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 2 }}>EDIT</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    {isAdmin ? (
                      <View style={[styles.shareCodeSection, { backgroundColor: isDark ? theme.background : "#F8F9FA" }]}>
                        <Text style={[styles.shareCodeLabel, { color: theme.textSecondary }]}>Invite code (admin only):</Text>
                        <View style={[styles.shareCodeBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                          <Text style={[styles.shareCodeText, { color: theme.text }]}>{shareCode ?? "…"}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.shareCodeSection}>
                        <Text style={styles.shareCodeLabel}>Invite code</Text>
                        <Text style={styles.descriptionText}>Only admins can view the invite code.</Text>
                      </View>
                    )}

                    <View style={styles.descriptionInfoSection}>
                      <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Group Name</AppText>
                      {isAdmin ? (
                        <View style={[styles.descriptionEditBox, { backgroundColor: isDark ? theme.background : "#F8F9FA", borderColor: theme.border }]}>
                          <TextInput style={[styles.descriptionInput, { color: theme.text, minHeight: 40 }, Platform.OS === "web" && ({ cursor: "text" } as any)]} value={editedName} onChangeText={setEditedName} placeholder="Group Name" placeholderTextColor={theme.textSecondary} />
                          {editedName !== group?.name && (
                            <TouchableOpacity style={styles.saveDescriptionBtn} onPress={handleUpdateGroupName}>
                              <Text style={styles.saveDescriptionBtnText}>Save</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.modalTitle, { color: theme.text, marginHorizontal: 0, marginBottom: 12 }]}>{group?.name}</Text>
                      )}

                      <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Description</AppText>
                      {isAdmin ? (
                        <View style={[styles.descriptionEditBox, { backgroundColor: isDark ? theme.background : "#F8F9FA", borderColor: theme.border }]}>
                          <TextInput style={[styles.descriptionInput, { color: theme.text }, Platform.OS === "web" && ({ cursor: "text" } as any)]} value={editedDescription} onChangeText={setEditedDescription} placeholder="Add a group description..." placeholderTextColor={theme.textSecondary} multiline />
                          {editedDescription !== group?.description && (
                            <TouchableOpacity style={styles.saveDescriptionBtn} onPress={handleUpdateDescription}>
                              <Text style={styles.saveDescriptionBtnText}>Save</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.descriptionText, { color: theme.text }]}>{group?.description || "No description set."}</Text>
                      )}
                    </View>

                    {/* Predictions Summary */}
                    <View style={styles.predictionsSection}>
                      <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Predictions</AppText>
                      <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: isDark ? theme.background : "#F2F2F7", borderColor: theme.border }]} onPress={() => setOpenExpanded((v) => !v)} activeOpacity={0.8}>
                        <Text style={[styles.accordionTitle, { color: theme.text }]}>Open</Text>
                        <View style={styles.accordionRight}>
                          <Text style={styles.accordionCount}>{openMarkets.length}</Text>
                          <Text style={styles.accordionChevron}>{openExpanded ? "▾" : "▸"}</Text>
                        </View>
                      </TouchableOpacity>
                      {openExpanded && (
                        <View style={styles.accordionBody}>
                          {marketsLoading ? <ActivityIndicator size="small" color="#999" style={{ marginVertical: 8 }} /> : openMarkets.length === 0 ? <Text style={styles.accordionEmpty}>No open predictions.</Text> : (
                            openMarkets.map((m: any) => (
                              <TouchableOpacity key={m.id} style={styles.marketRow} onPress={() => navigate(`/market/${m.id}`, { message: "Preparing the market..." })} activeOpacity={0.8}>
                                <View style={styles.marketRowLeft}>
                                  <Text style={styles.marketRowTitle} numberOfLines={2}>{m.question}</Text>
                                  <Text style={styles.marketRowMeta}>Closes: {formatClosesAt(m.closes_at)}</Text>
                                </View>
                                <Text style={[styles.marketStatusPill, styles.marketStatusOpen]}>OPEN</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </View>
                      )}

                      <TouchableOpacity style={[styles.accordionHeader, { marginTop: 10, backgroundColor: isDark ? theme.background : "#F2F2F7", borderColor: theme.border }]} onPress={() => setClosedExpanded((v) => !v)} activeOpacity={0.8}>
                        <Text style={[styles.accordionTitle, { color: theme.text }]}>Closed</Text>
                        <View style={styles.accordionRight}>
                          <Text style={[styles.accordionCount, { color: theme.textSecondary }]}>{closedMarkets.length}</Text>
                          <Text style={[styles.accordionChevron, { color: theme.textSecondary }]}>{closedExpanded ? "▾" : "▸"}</Text>
                        </View>
                      </TouchableOpacity>
                      {closedExpanded && (
                        <View style={styles.accordionBody}>
                          {marketsLoading ? <ActivityIndicator size="small" color="#999" style={{ marginVertical: 8 }} /> : closedMarkets.length === 0 ? <Text style={styles.accordionEmpty}>No closed predictions.</Text> : (
                            closedMarkets.map((m: any) => (
                              <TouchableOpacity key={m.id} style={styles.marketRow} onPress={() => navigate(`/market/${m.id}`, { message: "Preparing the market..." })} activeOpacity={0.8}>
                                <View style={styles.marketRowLeft}>
                                  <Text style={styles.marketRowTitle} numberOfLines={2}>{m.question}</Text>
                                  <Text style={styles.marketRowMeta}>Closed: {formatClosesAt(m.closes_at)}</Text>
                                </View>
                                <Text style={[styles.marketStatusPill, styles.marketStatusClosed]}>CLOSED</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </View>
                      )}
                    </View>

                    <AppText variant="label" color="secondary" style={styles.modalSectionTitle}>Members</AppText>
                  </>
                }
                ListHeaderComponentStyle={{ paddingBottom: 16 }}
                data={members}
                keyExtractor={(item: any) => item.user_id}
                renderItem={({ item }: { item: any }) => (
                  <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: theme.text }]}>
                        {item.users?.email || item.users?.username || "Anonymous User"}
                        {item.user_id === user?.id && " (You)"}
                      </Text>
                      <Text style={styles.memberRole}>{item.role.toUpperCase()}</Text>
                    </View>
                    {isAdmin && item.role !== "admin" && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity style={styles.promoteBtn} onPress={() => promoteToAdmin(item.user_id)}>
                          <Text style={styles.promoteBtnText}>Make Admin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.removeMemberBtn} onPress={() => handleRemoveMember(item.user_id)}>
                          <Text style={styles.removeMemberBtnText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 0 }]} />}
                ListFooterComponent={
                  isAdmin ? (
                    <View style={[styles.adminDangerZone, { marginTop: 40, paddingBottom: 40 }]}>
                      <TouchableOpacity style={styles.deleteGroupBtnFlat} onPress={handleDeleteGroup}>
                        <Text style={styles.deleteGroupBtnTextFlat}>Delete Group</Text>
                      </TouchableOpacity>
                    </View>
                  ) : <View style={{ height: 40 }} />
                }
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20 }}
                showsVerticalScrollIndicator={false}
              />
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Quick Bet Modal ────────────────────────────────────────── */}
      <Modal visible={betModalVisible} transparent animationType="slide" onRequestClose={() => setBetModalVisible(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setBetModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.modalKeyboardAvoiding}
            pointerEvents="box-none"
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()} 
              style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border, minHeight: 200 }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Place Bet</Text>
                <TouchableOpacity onPress={() => setBetModalVisible(false)} style={styles.modalCloseButton}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {selectedMarket && (
                <View style={[styles.betContext, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderRadius: 12, margin: 20, marginBottom: 10 }]}>
                  <Text style={[styles.betQuestion, { color: theme.text }]}>{selectedMarket.question}</Text>
                  <View style={styles.betMeta}>
                    <Text style={[styles.betBalance, { color: theme.textSecondary }]}>Balance: {formatCurrency(balance)}</Text>
                    <Text style={[styles.betSide, { color: selectedSide === "yes" ? theme.primary : "#EF4444", fontWeight: "600" }]}>
                      Predicting: {selectedSide?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.quickAmounts}>
                {[10, 25, 50, 100].map((amt) => (
                  <TouchableOpacity key={amt} style={[styles.quickChip, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#E5E5EA" }]} onPress={() => setBetAmount(amt.toString())}>
                    <Text style={[styles.quickChipText, { color: theme.text }]}>${amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.betInputWrapper, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7", borderColor: theme.border, borderWidth: 1 }]}>
                <Text style={[styles.currencyPrefix, { color: theme.text }]}>$</Text>
                <TextInput
                  testID="bet-amount"
                  style={[styles.betInput, { color: theme.text, backgroundColor: "transparent" }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
                  placeholder="0.00" placeholderTextColor={theme.textSecondary}
                  value={betAmount} onChangeText={setBetAmount} keyboardType="numeric" autoFocus
                />
              </View>

              {(() => {
                const amt = parseFloat(betAmount);
                if (isNaN(amt) || amt <= 0) return null;
                return (
                  <View style={styles.payoutPreview}>
                    <Text style={[styles.payoutLabel, { color: theme.textSecondary }]}>Potential Payout</Text>
                    <Text style={[styles.payoutValue, { color: theme.primary }]}>{formatCurrency(amt * 1.85)}</Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                testID="bet-place"
                style={[styles.betButton, { backgroundColor: theme.primary }, (isPlacingBet || !betAmount) && { opacity: 0.5 }]}
                onPress={handlePlaceBet} disabled={isPlacingBet || !betAmount}
              >
                {isPlacingBet ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={[styles.betButtonText, { color: theme.onPrimary }]}>Confirm Prediction</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — kept at end of file per user preference
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  centeredFallback: { justifyContent: "center", alignItems: "center", padding: 24 },
  fallbackTitle: { fontSize: 20, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  fallbackBody: { fontSize: 15, textAlign: "center", marginBottom: 20, lineHeight: 22 },
  fallbackButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  fallbackButtonText: { fontSize: 16, fontWeight: "600" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  backButton: { padding: 8, marginLeft: -8 },
  backButtonText: { fontSize: 17, color: Brand.primary, marginLeft: 4 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerSubtitle: { fontSize: 12, color: "#8E8E93" },
  headerInfo: { alignItems: "center", flexDirection: "row" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerCreateAction: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  headerCreateActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  headerInfoAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionText: { fontSize: 17, color: Brand.primary, fontWeight: "600" },
  groupHeaderAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  groupHeaderAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: 10, alignItems: "center", justifyContent: "center" },
  groupHeaderAvatarInitials: { fontSize: 14, fontWeight: "600" },
  statusBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalKeyboardAvoiding: { justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  modalCloseButton: { padding: 4 },
  closeModalText: { fontSize: 17, color: Brand.primary },
  modalSection: { gap: 8 },
  modalSectionTitle: { fontSize: 13, fontWeight: "600", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.3 },
  modalInput: { fontSize: 16, padding: 16, borderRadius: 12 },
  optionInputRow: {},
  optionCheck: {},
  optionInput: { fontSize: 16 },
  addOptionBtn: {},
  addOptionBtnText: { fontSize: 15, fontWeight: "600" },
  firstBetGuideCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  firstBetGuideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  firstBetGuideIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  firstBetGuideLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  firstBetGuideTitle: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  firstBetGuideBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  dateButton: {},
  dateText: { fontSize: 16 },
  initialBetInputRow: {},
  currencyPrefix: { fontSize: 16, fontWeight: "600" },
  initialBetInput: { fontSize: 16 },
  betWarningText: { fontSize: 12 },
  createButton: {},
  createButtonText: { fontSize: 17, fontWeight: "600" },
  imagePickerButton: { justifyContent: "center", alignItems: "center", overflow: "hidden" },
  selectedImage: { width: "100%", height: "100%", borderRadius: 20 },
  imagePickerPlaceholder: { justifyContent: "center", alignItems: "center" },
  imagePickerText: { fontSize: 15, fontWeight: "600" },

  // Group Info Modal
  modalGroupAvatarContainer: { alignItems: "center", marginVertical: 20 },
  modalGroupAvatar: { width: 100, height: 100, borderRadius: 50 },
  modalGroupAvatarPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  modalGroupAvatarInitials: { fontSize: 32, fontWeight: "600" },
  uploadProgressOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 50, alignItems: "center", justifyContent: "center" },
  shareCodeSection: { padding: 20, borderRadius: 16, margin: 20, marginTop: 0 },
  shareCodeLabel: { fontSize: 13, color: "#8E8E93", marginBottom: 8 },
  shareCodeBox: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  shareCodeText: { fontSize: 20, fontWeight: "600", letterSpacing: 2 },
  descriptionText: { fontSize: 15, color: "#8E8E93", lineHeight: 22 },
  descriptionInfoSection: { paddingHorizontal: 20, gap: 12 },
  descriptionEditBox: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  descriptionInput: { fontSize: 15, minHeight: 60 },
  saveDescriptionBtn: { marginTop: 8, alignSelf: "flex-end" },
  saveDescriptionBtnText: { fontSize: 15, color: Brand.primary, fontWeight: "600" },
  predictionsSection: { padding: 20, gap: 8 },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  accordionTitle: { fontSize: 16, fontWeight: "600" },
  accordionRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  accordionCount: { fontSize: 14, fontWeight: "600", color: Brand.primary },
  accordionChevron: { fontSize: 14, color: Brand.primary },
  accordionBody: { paddingVertical: 8, gap: 8 },
  accordionEmpty: { fontSize: 14, color: "#8E8E93", textAlign: "center", paddingVertical: 12 },
  marketRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  marketRowLeft: { flex: 1, marginRight: 12 },
  marketRowTitle: { fontSize: 15, fontWeight: "400" },
  marketRowMeta: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  marketStatusPill: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  marketStatusOpen: { color: Brand.primary, backgroundColor: Brand.primarySoft },
  marketStatusClosed: { color: "#8E8E93", backgroundColor: "#F2F2F7" },

  // Members
  memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5EA" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: "400" },
  memberRole: { fontSize: 13, color: "#8E8E93" },
  promoteBtn: { padding: 8 },
  promoteBtnText: { fontSize: 14, color: Brand.primary, fontWeight: "600" },
  removeMemberBtn: { padding: 8 },
  removeMemberBtnText: { fontSize: 14, color: "#FF3B30", fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#C6C6C8", marginVertical: 8 },
  adminDangerZone: { marginTop: 32, marginBottom: 40, paddingHorizontal: 20 },
  deleteGroupBtnFlat: { alignItems: "center", padding: 16 },
  deleteGroupBtnTextFlat: { color: "#FF3B30", fontSize: 16, fontWeight: "600" },

  // Bet Modal
  betContext: { padding: 20, backgroundColor: "#F2F2F7", marginBottom: 10 },
  betQuestion: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  betMeta: { flexDirection: "row", justifyContent: "space-between" },
  betBalance: { fontSize: 14, color: "#8E8E93" },
  betSide: { fontSize: 14 },
  betInputWrapper: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, backgroundColor: "#F2F2F7", borderRadius: 12, padding: 16, marginVertical: 20 },
  betInput: { flex: 1, fontSize: 18, fontWeight: "600", marginLeft: 8 },
  betButton: { margin: 20, backgroundColor: Brand.primary, padding: 16, borderRadius: 16, alignItems: "center" },
  betButtonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  quickAmounts: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginBottom: 16 },
  quickChip: { flex: 1, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(142, 142, 147, 0.2)" },
  quickChipText: { fontSize: 13, fontWeight: "600" },
  payoutPreview: { marginHorizontal: 20, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: "rgba(0, 122, 255, 0.05)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payoutLabel: { fontSize: 14, fontWeight: "400" },
  payoutValue: { fontSize: 16, fontWeight: "600" },
  attachMenuContent: {
    width: 280,
    borderRadius: 24,
    padding: 16,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    alignSelf: 'center', // Center it in the overlay
  },
  attachMenuTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  attachMenuItemText: {
    fontSize: 17,
    fontWeight: '400',
    marginLeft: 12,
  },
});
