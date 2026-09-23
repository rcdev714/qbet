import { AnymarktLoader } from "@/components/AnymarktLoader";
import { GroupInfoModal } from "@/components/GroupInfoModal";
import { ActiveBetsTab } from "@/components/group-chat/ActiveBetsTab";
import { ChatTab } from "@/components/group-chat/ChatTab";
import { GroupAttachSheet } from "@/components/group-chat/GroupAttachSheet";
import type { GroupTab } from "@/components/group-chat/GroupTabBar";
import { GroupTabBar } from "@/components/group-chat/GroupTabBar";
import { HistoryTab } from "@/components/group-chat/HistoryTab";
import { RankingsTab } from "@/components/group-chat/RankingsTab";
import { CreatePredictionModal } from "@/components/group/CreatePredictionModal";
import { GroupMembersModal } from "@/components/group/GroupMembersModal";
import { GroupScreenHeader } from "@/components/group/GroupScreenHeader";
import { QuickBetModal } from "@/components/group/QuickBetModal";
import { SettlementFeedbackFlow } from "@/components/group-member/SettlementFeedbackFlow";
import { PublicBetPickerModal } from "@/components/PublicBetPickerModal";
import { AppScreen, AppText, EmptyState } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAppLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { useGroup, useGroupMembers } from "@/hooks/useGroups";
import { useGroupMarkets } from "@/hooks/useMarket";
import { useMessages } from "@/hooks/useMessages";
import { usePremiumNavigation } from "@/hooks/usePremiumNavigation";
import { useSettlementFeedbackPrompt } from "@/hooks/useSettlementFeedbackPrompt";
import { alertBetPlacedWithContract } from "@/lib/bet-contract-ui";
import { getSportsBlockMessage, scanMarketTextForSports } from "@/lib/compliance/sports-content";
import { logger } from "@/lib/logger";
import { getParamString } from "@/lib/route-params";
import { supabase } from "@/lib/supabase";
import { betService } from "@/services/bet.service";
import { complianceService } from "@/services/compliance.service";
import { groupService } from "@/services/group.service";
import { marketService } from "@/services/market.service";
import { mentionService } from "@/services/mention.service";
import { shareService } from "@/services/share.service";
import type { Market, MarketOption } from "@/types/market";
import type { MentionEmbedPayload } from "@/types/mention";
import type { Message } from "@/types/message";
import { decode } from "base64-arraybuffer";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";

function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function GroupScreen({ embedded = false }: { embedded?: boolean }) {
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
  const resolvedGroupMarkets = useMemo(
    () => markets.filter((m) => m.status === "resolved" && m.group_id),
    [markets],
  );
  const settlementFeedback = useSettlementFeedbackPrompt({
    markets: resolvedGroupMarkets,
    userId: user?.id,
    enabled: activeTab === "history" && !!groupId,
  });
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
    if (Platform.OS !== "web") {
      Keyboard.dismiss();
    }
    const { error } = await sendMessage({ user_id: user.id, content: text, message_type: "text" });
    if (error) { Alert.alert("Message wasn't sent", "Your text is back in the composer. Check your connection and try again."); setInputText(text); }
  };

  const handleSendSticker = async (content: string) => {
    if (!user) return;
    const { error } = await sendMessage({ user_id: user.id, content, message_type: "sticker" });
    if (error) {
      Alert.alert("Sticker wasn't sent", "Check your connection and try again.");
    }
  };

  const handleSendMention = async (payload: MentionEmbedPayload) => {
    if (!user || !groupId) return;
    if (Platform.OS !== "web") {
      Keyboard.dismiss();
    }
    const insert = mentionService.buildGroupMessageInsert(groupId, user.id, payload);
    const { group_id: _groupId, ...messageData } = insert;
    const { error } = await sendMessage(messageData);
    if (error) {
      Alert.alert("Couldn't share", error.message);
    }
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
  if (groupLoading && !embedded) {
    return <AnymarktLoader message="Opening your group..." />;
  }

  if (groupLoading && embedded) {
    return (
      <View style={[styles.embeddedRoot, { backgroundColor: theme.surface }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!groupId || !group) {
    const notFound = (
      <EmptyState
        icon="people-outline"
        title="Group not found"
        description="This group may have been deleted or you may not have access."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );

    if (embedded) {
      return (
        <View style={[styles.embeddedRoot, styles.centerContainer, { backgroundColor: theme.background }]}>
          {notFound}
        </View>
      );
    }

    return (
      <AppScreen columnVariant="social" style={styles.centerContainer}>
        {notFound}
      </AppScreen>
    );
  }

  const activeGroupId = group.id;

  const screenContent = (
    <View style={styles.screenRoot}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <GroupScreenHeader
        groupName={group?.name || "Group"}
        avatarUrl={group?.avatar_url}
        variant={embedded ? "split" : "stack"}
        isAdmin={isAdmin}
        onBack={() => router.back()}
        onOpenInfo={() => setGroupInfoVisible(true)}
        onCreatePrediction={() => setCreateModalVisible(true)}
        onManage={
          isAdmin
            ? () => router.push(`/manage/groups/${activeGroupId}` as never)
            : undefined
        }
      />

      {statusBanner ? (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: theme.primarySoft,
              borderColor: theme.primary,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <IconSymbol name="checkmark" size={16} color={theme.success} />
          <AppText variant="bodySm" style={{ flex: 1 }}>
            {statusBanner}
          </AppText>
        </View>
      ) : null}

      {/* ── Tab Bar ─────────────────────────────────────────────────── */}
      <GroupTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        openCount={openMarkets.length}
      />

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      <View style={styles.tabContent}>
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
          groupId={activeGroupId ?? ""}
          onSendMention={handleSendMention}
          onSendSticker={handleSendSticker}
          onBet={handleOpenBet}
          onResolve={handleResolveMarket}
          embedded={embedded}
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
      </View>

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

      {/* ── Attach Menu (Web bottom sheet) ──────────────────────────── */}
      <GroupAttachSheet
        visible={isAttachMenuVisible}
        onClose={() => setAttachMenuVisible(false)}
        onInvite={() => {
          setAttachMenuVisible(false);
          void handleCopyInviteCode();
        }}
        onSendImage={() => {
          setAttachMenuVisible(false);
          pickChatImage();
        }}
        onCreatePrediction={() => {
          setAttachMenuVisible(false);
          setCreateModalVisible(true);
        }}
        onSharePublicBet={() => {
          setAttachMenuVisible(false);
          setPublicBetPickerVisible(true);
        }}
      />

      <CreatePredictionModal
        visible={isCreateModalVisible}
        onClose={() => setCreateModalVisible(false)}
        isFirstBetOnboarding={isFirstBetOnboarding}
        newQuestion={newQuestion}
        onQuestionChange={setNewQuestion}
        newOptions={newOptions}
        onUpdateOption={updateOption}
        onRemoveOption={removeOption}
        onAddOption={addOption}
        selectedInitialOption={selectedInitialOption}
        onSelectInitialOption={setSelectedInitialOption}
        closesAt={closesAt}
        onClosesAtChange={setClosesAt}
        showDatePicker={showDatePicker}
        onShowDatePickerChange={setShowDatePicker}
        initialBetAmount={initialBetAmount}
        onInitialBetAmountChange={setInitialBetAmount}
        marketImage={marketImage}
        onPickMarketImage={pickMarketImage}
        createLoading={createLoading}
        onCreate={handleCreateMarket}
      />

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

      <GroupMembersModal
        visible={isMembersModalVisible}
        onClose={() => setMembersModalVisible(false)}
        group={group}
        members={members}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        shareCode={shareCode}
        editedName={editedName}
        onEditedNameChange={setEditedName}
        editedDescription={editedDescription}
        onEditedDescriptionChange={setEditedDescription}
        onUpdateGroupName={handleUpdateGroupName}
        onUpdateDescription={handleUpdateDescription}
        onPickGroupImage={pickGroupImage}
        isUploadingGroupAvatar={isUploadingGroupAvatar}
        onOpenGroupInfo={() => setGroupInfoVisible(true)}
        openMarkets={openMarkets}
        closedMarkets={closedMarkets}
        marketsLoading={marketsLoading}
        openExpanded={openExpanded}
        onOpenExpandedChange={setOpenExpanded}
        closedExpanded={closedExpanded}
        onClosedExpandedChange={setClosedExpanded}
        formatClosesAt={formatClosesAt}
        onMarketPress={(marketId) => navigate(`/market/${marketId}`, { message: "Preparing the market..." })}
        onPromoteToAdmin={promoteToAdmin}
        onRemoveMember={handleRemoveMember}
        onDeleteGroup={handleDeleteGroup}
      />

      <QuickBetModal
        visible={betModalVisible}
        onClose={() => setBetModalVisible(false)}
        selectedMarket={selectedMarket}
        selectedSide={selectedSide}
        balance={balance}
        betAmount={betAmount}
        onBetAmountChange={setBetAmount}
        isPlacingBet={isPlacingBet}
        onPlaceBet={handlePlaceBet}
      />

      {settlementFeedback.promptMarket ? (
        <SettlementFeedbackFlow
          visible={settlementFeedback.visible}
          marketId={settlementFeedback.promptMarket.id}
          marketQuestion={settlementFeedback.promptMarket.question}
          onSkip={() => void settlementFeedback.dismiss()}
          onNotSure={settlementFeedback.closeWithoutPersist}
          onSubmit={settlementFeedback.submitRating}
        />
      ) : null}
    </View>
  );

  if (embedded) {
    return (
      <View style={[styles.embeddedRoot, { backgroundColor: theme.surface }]}>
        {screenContent}
      </View>
    );
  }

  return (
    <AppScreen
      columnVariant="social"
      style={{ flex: 1, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0, backgroundColor: theme.surface }}
    >
      {screenContent}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    minHeight: 0,
  },
  embeddedRoot: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
  },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  statusBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
