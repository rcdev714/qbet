import { decode } from "base64-arraybuffer";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Router, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { MarketCard } from "../components/MarketCard";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { useGroup, useGroupMembers } from "../hooks/useGroups";
import { useGroupMarkets, useMarket } from "../hooks/useMarket";
import { useMessages } from "../hooks/useMessages";
import { getRandomColor } from "../lib/colors";
import { formatCurrency } from "../lib/parimutuel";
import { supabase } from "../lib/supabase";
import { betService } from "../services/bet.service";
import { groupService } from "../services/group.service";
import { marketService } from "../services/market.service";
import type { Market, MarketOption } from "../types/market";
import type { Message } from "../types/message";
// Removed RootStackParamList import

function MarketMessage({ marketId, router, onBet, onResolve, currentUserId, isAdmin, refreshTrigger }: {
  marketId: string,
  router: Router,
  onBet: (market: Market, optionId: string) => void,
  onResolve: (marketId: string, optionId: string) => void,
  currentUserId?: string,
  isAdmin?: boolean,
  refreshTrigger?: number
}) {
  const { market, options, loading, refresh } = useMarket(marketId);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh();
    }
  }, [refreshTrigger]);

  if (loading) return <ActivityIndicator size="small" color="#999" style={{ margin: 20 }} />;
  if (!market) return null;

  return (
    <View style={styles.marketMessageContainer}>
      <MarketCard
        market={market}
        options={options}
        onSelectOption={(optionId) => onBet(market, optionId)}
        onResolve={(optionId) => onResolve(market.id, optionId)}
        onViewDistribution={() => router.push(`/bet/${marketId}` as any)}
        canResolve={isAdmin}
        compact
      />
    </View>
  );
}

export function GroupScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const { balance, refresh: refreshWallet } = useWalletContext();
  const { group, loading: groupLoading } = useGroup(groupId);
  const { members, promoteToAdmin, removeMember, loading: membersLoading } = useGroupMembers(groupId);
  const { messages, loading: messagesLoading, sendMessage, addOptimisticMessage, updateOptimisticMessage, removeOptimisticMessage } = useMessages(groupId);

  const { markets, loading: marketsLoading, refresh: refreshMarkets } = useGroupMarkets(groupId);
  const [marketRefreshTrigger, setMarketRefreshTrigger] = useState(0);

  const [inputText, setInputText] = useState("");
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isMembersModalVisible, setMembersModalVisible] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [newDuration, setNewDuration] = useState<string>("24h");
  const [initialBetAmount, setInitialBetAmount] = useState("");
  const [selectedInitialOption, setSelectedInitialOption] = useState<number | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [marketImage, setMarketImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Bet State
  const [betModalVisible, setBetModalVisible] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const isAdmin = members.find(m => m.user_id === user?.id)?.role === 'admin';
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [openExpanded, setOpenExpanded] = useState(false);
  const [closedExpanded, setClosedExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadShareCode = async () => {
      if (!isAdmin) {
        setShareCode(null);
        return;
      }

      const { shareCode: code, error } = await groupService.getGroupShareCode(groupId);
      if (cancelled) return;

      if (error) {
        // Don't block the screen; just hide it if we can't load.
        setShareCode(null);
        return;
      }

      setShareCode(code);
    };

    loadShareCode();

    return () => {
      cancelled = true;
    };
  }, [groupId, isAdmin]);

  useEffect(() => {
    if (group?.description) {
      setEditedDescription(group.description);
    }
  }, [group]);

  // Scroll to end when messages change (with slight delay to ensure render)
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const openMarkets = markets.filter((m) => m.status === "open");
  const closedMarkets = markets.filter((m) => m.status === "closed");

  const formatClosesAt = (iso: string | null) => {
    if (!iso) return "No close time";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "No close time";
    return d.toLocaleString();
  };

  const handleUpdateDescription = async () => {
    if (!group || !isAdmin) return;
    try {
      const { error } = await groupService.updateGroup(group.id, { description: editedDescription });
      if (error) throw error;
      // Success - no extra state needed as editedDescription already matches group.description once updated or refreshed
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      Alert.alert("Error", errorMessage);
    }
  };

  const handleRemoveMember = (memberUserId: string) => {
    if (!isAdmin) return;
    if (!user) return;
    if (memberUserId === user.id) return;

    Alert.alert(
      "Remove Member",
      "Are you sure you want to remove this member from the group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await removeMember(memberUserId);
            if (error) {
              Alert.alert("Error", error.message);
              return;
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    if (!isAdmin || !group) return;

    Alert.alert(
      "Delete Group",
      "This will permanently delete the group, its predictions, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Group",
          style: "destructive",
          onPress: async () => {
            const { error } = await groupService.deleteGroup(group.id);
            if (error) {
              Alert.alert("Error", error.message);
              return;
            }
            setMembersModalVisible(false);
            router.replace("/" as any);
          },
        },
      ]
    );
  };

  const DURATIONS = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '24h', value: '24h' },
    { label: '2d', value: '48h' },
    { label: '7d', value: '168h' },
  ];

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;

    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();

    const { error } = await sendMessage({
      user_id: user.id,
      content: text,
      message_type: "text",
    });

    if (error) {
      Alert.alert("Error", "Failed to send message");
      setInputText(text);
    }
  };

  const pickMarketImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setMarketImage(result.assets[0]);
    }
  };

  const handleCreateMarket = async () => {
    const filteredOptions = newOptions.filter(opt => opt.trim() !== "");
    if (!newQuestion.trim() || filteredOptions.length < 2) {
      Alert.alert("Error", "Please enter a question and at least 2 options");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to create a prediction");
      return;
    }

    // Calculate end date
    const closesAt = new Date();
    const hours = parseInt(newDuration.replace('h', ''));
    closesAt.setHours(closesAt.getHours() + hours);

    // Generate a temporary ID for optimistic UI
    const tempId = `temp_market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Create optimistic market message (appears immediately)
    const optimisticMessage: Message = {
      id: tempId,
      group_id: groupId,
      user_id: user.id,
      content: `New Market: ${newQuestion}`,
      message_type: 'market',
      market_id: tempId, // Use temp ID for market_id too (will show loading state)
      created_at: now,
      status: 'sending',
    };

    // Close modal and reset form immediately for snappy UX
    setCreateModalVisible(false);
    Keyboard.dismiss();

    // Add optimistic message to the chat immediately
    addOptimisticMessage(optimisticMessage);

    setCreateLoading(true);
    try {
      let imageUrl = undefined;
      if (marketImage && marketImage.base64) {
        try {
            const timestamp = Date.now();
            const fileName = `${groupId}/${timestamp}.jpg`;
            const arrayBuffer = decode(marketImage.base64);

            const { error: uploadError } = await supabase.storage
            .from('market-images')
            .upload(fileName, arrayBuffer, {
              contentType: marketImage.mimeType ?? 'image/jpeg',
              upsert: false
            });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
            .from('market-images')
            .getPublicUrl(fileName);

            imageUrl = publicUrl;
        } catch (e) {
          console.error("Image upload failed", e);
          // Continue without image, but maybe log it?
          // We could alert user but we want to proceed.
        }
      }

      const { market, error } = await marketService.createMarket({
        groupId,
        question: newQuestion,
        options: filteredOptions,
        closesAt: closesAt,
        imageUrl: imageUrl
      });

      if (error) throw error;

      // Update the optimistic message with the real market ID and 'sent' status
      if (market) {
        updateOptimisticMessage(tempId, {
          market_id: market.id,
          status: 'sent',
        });

        // After a short delay, mark as delivered
        setTimeout(() => {
          updateOptimisticMessage(tempId, {
            status: 'delivered',
          });
        }, 500);
      }

      // Handle initial bet if specified
      if (market && initialBetAmount && selectedInitialOption !== null) {
        const amount = parseFloat(initialBetAmount);
        if (!isNaN(amount) && amount > 0) {
          if (amount > balance) {
            Alert.alert("Market Created", "Prediction created, but initial bet failed due to insufficient balance.");
          } else {
            // Find the option ID for the selected initial option
            const options = await marketService.getMarketOptions(market.id);
            const optionToBet = options?.find((o: MarketOption) => o.label === filteredOptions[selectedInitialOption]);

            if (optionToBet) {
              const { error: betError } = await betService.placeBet({
                marketId: market.id,
                optionId: optionToBet.id,
                amount,
              });

              if (betError) {
                Alert.alert("Market Created", `Prediction created, but initial bet failed: ${betError.message}`);
              } else {
                refreshWallet();
              }
            }
          }
        }
      }

      // Reset form state
      setNewQuestion("");
      setNewOptions(["", ""]);
      setNewDuration("24h");
      setInitialBetAmount("");
      setSelectedInitialOption(null);
      setMarketImage(null);
    } catch (error) {
      // Remove the optimistic message on error
      removeOptimisticMessage(tempId);

      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      Alert.alert("Error", errorMessage);
      // Re-open modal on error so user can try again
      setCreateModalVisible(true);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResolveMarket = async (marketId: string, optionId: string) => {
    Alert.alert(
      "Resolve Market",
      "Are you sure you want to set this as the winning result? All payouts will be distributed instantly.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Result",
          onPress: async () => {
            try {
              const { error } = await marketService.resolveMarket(marketId, optionId);
              if (error) throw error;
              Alert.alert("Success", "Market resolved and payouts distributed!");
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "An error occurred";
              Alert.alert("Error", errorMessage);
            }
          }
        }
      ]
    );
  };

  const addOption = () => {
    setNewOptions([...newOptions, ""]);
  };

  const updateOption = (text: string, index: number) => {
    const updated = [...newOptions];
    updated[index] = text;
    setNewOptions(updated);
  };

  const removeOption = (index: number) => {
    if (newOptions.length > 2) {
      const updated = newOptions.filter((_, i) => i !== index);
      setNewOptions(updated);
      if (selectedInitialOption === index) setSelectedInitialOption(null);
      else if (selectedInitialOption !== null && selectedInitialOption > index) {
        setSelectedInitialOption(selectedInitialOption - 1);
      }
    }
  };

  const handleOpenBet = (market: Market, optionId: string) => {
    Keyboard.dismiss();
    setSelectedMarket(market);
    setSelectedOptionId(optionId);
    setBetModalVisible(true);
  };

  const handlePlaceBet = async () => {
    if (!selectedMarket || !selectedOptionId || !betAmount || !user) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Enter a valid amount");
      return;
    }

    if (amount > balance) {
      Alert.alert("Error", "Insufficient balance");
      return;
    }

    Keyboard.dismiss();
    setIsPlacingBet(true);
    const { error } = await betService.placeBet({
      marketId: selectedMarket.id,
      optionId: selectedOptionId,
      amount,
    });

    setIsPlacingBet(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setBetModalVisible(false);
      setBetAmount("");
      refreshWallet();
      refreshMarkets();
      setMarketRefreshTrigger(prev => prev + 1);
      Alert.alert("Success", "Bet placed successfully!");
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.user_id === user?.id;

    // Extract username from email (before @) or use username field
    const getDisplayName = () => {
      if (isMe) return null; // Don't show name for own messages

      // Try username first
      if (item.user?.username && item.user.username.trim()) {
        return item.user.username;
      }

      // Then try email (extract part before @)
      if (item.user?.email) {
        const emailParts = item.user.email.split('@');
        if (emailParts[0] && emailParts[0].trim()) {
          return emailParts[0];
        }
      }

      // Fallback: use first 8 chars of user_id
      if (item.user_id) {
        return item.user_id.substring(0, 8);
      }

      return "User";
    };

    const displayName = getDisplayName();

    // Render message status indicator (check marks) for own messages
    const renderStatusIndicator = (forMarket: boolean = false) => {
      if (!isMe) return null;

      const status = item.status || 'delivered'; // Default to delivered for older messages

      if (forMarket) {
        // For market messages, show colored indicators
        switch (status) {
          case 'sending':
            return <Text style={[styles.marketStatusIndicator, styles.marketStatusIndicatorGray]}>✓</Text>;
          case 'sent':
            return <Text style={[styles.marketStatusIndicator, styles.marketStatusIndicatorBlue]}>✓</Text>;
          case 'delivered':
            return <Text style={[styles.marketStatusIndicator, styles.marketStatusIndicatorBlue]}>✓✓</Text>;
          default:
            return <Text style={[styles.marketStatusIndicator, styles.marketStatusIndicatorBlue]}>✓✓</Text>;
        }
      }

      switch (status) {
        case 'sending':
          // Single gray check - message is being sent
          return <Text style={styles.statusIndicator}>✓</Text>;
        case 'sent':
          // Single blue check - message saved to server
          return <Text style={[styles.statusIndicator, styles.statusIndicatorBlue]}>✓</Text>;
        case 'delivered':
          // Double blue check - message visible to others
          return <Text style={[styles.statusIndicator, styles.statusIndicatorBlue]}>✓✓</Text>;
        default:
          return <Text style={[styles.statusIndicator, styles.statusIndicatorBlue]}>✓✓</Text>;
      }
    };

    if (item.message_type === "market" && item.market_id) {
      // Check if this is a temporary/optimistic market message
      const isOptimistic = item.market_id.startsWith('temp_');

      return (
        <View style={styles.marketWrapper}>
          <View style={styles.marketAnnounceRow}>
            <Text style={styles.marketAnnounce}>
              {isMe ? "You" : displayName || "Someone"} started a prediction
            </Text>
            {isMe && (
              <View style={styles.marketStatusRow}>
                <Text style={styles.marketTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {renderStatusIndicator(true)}
              </View>
            )}
          </View>
          {isOptimistic ? (
            // Show loading state for optimistic market
            <View style={styles.optimisticMarketCard}>
              <Text style={styles.optimisticMarketText}>{item.content?.replace('New Market: ', '')}</Text>
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 12 }} />
              <Text style={styles.optimisticMarketSubtext}>Creating prediction...</Text>
            </View>
          ) : (
            <MarketMessage
              marketId={item.market_id}
              router={router}
              onBet={handleOpenBet}
              onResolve={handleResolveMarket}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              refreshTrigger={marketRefreshTrigger}
            />
          )}
        </View>
      );
    }



    const Avatar = () => (
      <View style={styles.avatarContainer}>
        {item.user?.avatar_url ? (
          <Image
            source={{ uri: item.user.avatar_url }}
            style={styles.messageAvatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.messageAvatarPlaceholder, { backgroundColor: getRandomColor(displayName || "User") }]}>
             <Text style={styles.messageAvatarInitials}>{displayName?.[0]?.toUpperCase()}</Text>
          </View>
        )}
      </View>
    );

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
        {!isMe && <Avatar />}
        <View style={[
          styles.messageBubble,
          isMe
            ? [styles.myMessage, { backgroundColor: isDark ? "#004B91" : "#007AFF", borderBottomRightRadius: 2, borderTopRightRadius: 12 }]
            : [styles.theirMessage, { backgroundColor: theme.surface, borderBottomLeftRadius: 2, borderTopLeftRadius: 12 }],
          !isMe && { borderColor: theme.border, borderWidth: isDark ? 1 : 0 }
        ]}>
          {!isMe && displayName && (
            <Text style={[styles.senderName, { color: getRandomColor(displayName || "User") }]}>
              {displayName}
            </Text>
          )}
          <Text style={[styles.messageText, { color: isMe ? "#FFFFFF" : theme.text }]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {renderStatusIndicator()}
          </View>
        </View>
      </View>
    );
  };

  if (groupLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => setMembersModalVisible(true)}
        >
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{group?.name || "Group"}</Text>
          <Text style={styles.headerSubtitle}>
            {isAdmin ? `Code: ${shareCode ?? "…"} • Tap for Info` : "Tap for Info"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setCreateModalVisible(true)}
        >
          <Text style={[styles.headerActionText, { color: theme.primary }]}>+ Predict</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.chatArea, { backgroundColor: theme.background }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyMessageList
          ]}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>No messages yet</Text>
              <Text style={styles.emptyMessagesSubtext}>
                Start a conversation or create a prediction!
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          // Remove onContentSizeChange and onLayout to prevent render loop
          // Just scroll to end when messages change
          onEndReachedThreshold={0.1}
        />

        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              Keyboard.dismiss();
              setCreateModalVisible(true);
            }}
          >
            <Text style={styles.attachButtonText}>+</Text>
          </TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: isDark ? theme.background : "#F0F2F5" }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Type a message"
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>➔</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Create Market Modal */}
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoiding}
            >
              <View style={[styles.modalContent, { maxHeight: '90%', backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Create Prediction</Text>
                  <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                    <Text style={styles.closeModalText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={newOptions}
                  keyExtractor={(_, index) => index.toString()}
                  ListHeaderComponent={
                    <View>
                      <TouchableOpacity onPress={pickMarketImage} style={styles.imagePickerButton}>
                        {marketImage ? (
                          <Image source={{ uri: marketImage.uri }} style={styles.selectedImage} contentFit="cover" />
                        ) : (
                          <View style={styles.imagePickerPlaceholder}>
                            <Text style={styles.imagePickerText}>+ Add Banner Image</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.modalSection}>
                        <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Question</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: isDark ? theme.background : "#F0F2F5", color: theme.text }]}
                        placeholder="Ask a question..."
                        placeholderTextColor={theme.textSecondary}
                        value={newQuestion}
                        onChangeText={setNewQuestion}
                        multiline
                      />
                      <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Options</Text>
                    </View>
                    </View>
                  }
                  renderItem={({ item, index }) => (
                    <View style={[styles.optionInputRow, { backgroundColor: isDark ? theme.background : "#F0F2F5" }]}>
                      <TouchableOpacity
                        style={[
                          styles.optionCheck,
                          selectedInitialOption === index && styles.optionCheckSelected
                        ]}
                        onPress={() => setSelectedInitialOption(index)}
                      >
                        {selectedInitialOption === index && <View style={styles.optionCheckInner} />}
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.optionInput, { backgroundColor: isDark ? theme.background : "#F0F2F5", color: theme.text }]}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor={theme.textSecondary}
                        value={item}
                        onChangeText={(text) => updateOption(text, index)}
                      />
                      {newOptions.length > 2 && (
                        <TouchableOpacity onPress={() => removeOption(index)} style={styles.removeOptionBtn}>
                          <Text style={styles.removeOptionText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  ListFooterComponent={
                    <View style={styles.modalFooter}>
                      <TouchableOpacity style={styles.addOptionBtn} onPress={addOption}>
                        <Text style={styles.addOptionBtnText}>+ Add Option</Text>
                      </TouchableOpacity>

                      <View style={styles.durationSection}>
                        <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Prediction Duration</Text>
                        <View style={styles.durationRow}>
                          {DURATIONS.map((d) => (
                            <TouchableOpacity
                              key={d.value}
                              style={[
                                styles.durationBtn,
                                { backgroundColor: isDark ? theme.background : "#F0F2F5" },
                                newDuration === d.value && styles.durationBtnSelected
                              ]}
                              onPress={() => setNewDuration(d.value)}
                            >
                              <Text style={[
                                styles.durationBtnText,
                                newDuration === d.value && styles.durationBtnTextSelected
                              ]}>
                                {d.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.initialBetSection}>
                        <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Place Initial Bet (Optional)</Text>
                        <View style={[styles.initialBetInputRow, { backgroundColor: isDark ? theme.background : "#F0F2F5" }]}>
                          <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>$</Text>
                          <TextInput
                            style={[styles.initialBetInput, { color: theme.text }]}
                            placeholder="0.00"
                            placeholderTextColor={theme.textSecondary}
                            value={initialBetAmount}
                            onChangeText={setInitialBetAmount}
                            keyboardType="numeric"
                          />
                        </View>
                        {selectedInitialOption === null && initialBetAmount !== "" && (
                          <Text style={styles.betWarningText}>Please select an option to bet on</Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[styles.createButton, { backgroundColor: theme.primary }, createLoading && { opacity: 0.5 }, { marginTop: 20 }]}
                        onPress={handleCreateMarket}
                        disabled={createLoading}
                      >
                        <Text style={styles.createButtonText}>
                          {createLoading ? "Launching..." : "Launch Prediction"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                  style={{ flexGrow: 0 }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Members Modal */}
      <Modal
        visible={isMembersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMembersModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoiding}
            >
              <View style={[styles.modalContent, { maxHeight: '90%', backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Group Info</Text>
                  <TouchableOpacity onPress={() => setMembersModalVisible(false)}>
                    <Text style={styles.closeModalText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  ListHeaderComponent={
                    <>
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
                          <Text style={styles.descriptionText}>
                            Only admins can view the invite code.
                          </Text>
                        </View>
                      )}

                      <View style={styles.descriptionInfoSection}>
                        <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Description</Text>
                        {isAdmin ? (
                          <View style={[styles.descriptionEditBox, { backgroundColor: isDark ? theme.background : "#F8F9FA", borderColor: theme.border }]}>
                            <TextInput
                              style={[styles.descriptionInput, { color: theme.text }]}
                              value={editedDescription}
                              onChangeText={setEditedDescription}
                              placeholder="Add a group description..."
                              placeholderTextColor={theme.textSecondary}
                              multiline
                            />
                            {editedDescription !== group?.description && (
                              <TouchableOpacity
                                style={styles.saveDescriptionBtn}
                                onPress={handleUpdateDescription}
                              >
                                <Text style={styles.saveDescriptionBtnText}>Save</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <Text style={[styles.descriptionText, { color: theme.text }]}>
                            {group?.description || "No description set."}
                          </Text>
                        )}
                      </View>

                      {/* Predictions Summary */}
                      <View style={styles.predictionsSection}>
                        <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Predictions</Text>

                        <TouchableOpacity
                          style={[styles.accordionHeader, { backgroundColor: isDark ? theme.background : "#F2F2F7", borderColor: theme.border }]}
                          onPress={() => setOpenExpanded((v) => !v)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.accordionTitle}>Open</Text>
                          <View style={styles.accordionRight}>
                            <Text style={styles.accordionCount}>{openMarkets.length}</Text>
                            <Text style={styles.accordionChevron}>{openExpanded ? "▾" : "▸"}</Text>
                          </View>
                        </TouchableOpacity>
                        {openExpanded && (
                          <View style={styles.accordionBody}>
                            {marketsLoading ? (
                              <ActivityIndicator size="small" color="#999" style={{ marginVertical: 8 }} />
                            ) : openMarkets.length === 0 ? (
                              <Text style={styles.accordionEmpty}>No open predictions.</Text>
                            ) : (
                              openMarkets.map((m) => (
                                <TouchableOpacity
                                  key={m.id}
                                  style={styles.marketRow}
                                  onPress={() => router.push(`/market/${m.id}` as any)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.marketRowLeft}>
                                    <Text style={styles.marketRowTitle} numberOfLines={2}>
                                      {m.question}
                                    </Text>
                                    <Text style={styles.marketRowMeta}>
                                      Closes: {formatClosesAt(m.closes_at)}
                                    </Text>
                                  </View>
                                  <Text style={[styles.marketStatusPill, styles.marketStatusOpen]}>OPEN</Text>
                                </TouchableOpacity>
                              ))
                            )}
                          </View>
                        )}

                        <TouchableOpacity
                          style={[styles.accordionHeader, { marginTop: 10, backgroundColor: isDark ? theme.background : "#F2F2F7", borderColor: theme.border }]}
                          onPress={() => setClosedExpanded((v) => !v)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.accordionTitle, { color: theme.text }]}>Closed</Text>
                          <View style={styles.accordionRight}>
                            <Text style={[styles.accordionCount, { color: theme.textSecondary }]}>{closedMarkets.length}</Text>
                            <Text style={[styles.accordionChevron, { color: theme.textSecondary }]}>{closedExpanded ? "▾" : "▸"}</Text>
                          </View>
                        </TouchableOpacity>
                        {closedExpanded && (
                          <View style={styles.accordionBody}>
                            {marketsLoading ? (
                              <ActivityIndicator size="small" color="#999" style={{ marginVertical: 8 }} />
                            ) : closedMarkets.length === 0 ? (
                              <Text style={styles.accordionEmpty}>No closed predictions.</Text>
                            ) : (
                              closedMarkets.map((m) => (
                                <TouchableOpacity
                                  key={m.id}
                                  style={styles.marketRow}
                                  onPress={() => router.push(`/market/${m.id}` as any)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.marketRowLeft}>
                                    <Text style={styles.marketRowTitle} numberOfLines={2}>
                                      {m.question}
                                    </Text>
                                    <Text style={styles.marketRowMeta}>
                                      Closed: {formatClosesAt(m.closes_at)}
                                    </Text>
                                  </View>
                                  <Text style={[styles.marketStatusPill, styles.marketStatusClosed]}>CLOSED</Text>
                                </TouchableOpacity>
                              ))
                            )}
                          </View>
                        )}
                      </View>

                      <Text style={styles.modalSectionTitle}>Members</Text>
                    </>
                  }
                  ListHeaderComponentStyle={{ paddingBottom: 16 }}
                  data={members}
                  keyExtractor={(item) => item.user_id}
                  renderItem={({ item }) => (
                    <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: theme.text }]}>
                          {item.users?.email || item.users?.username || "Anonymous User"}
                          {item.user_id === user?.id && " (You)"}
                        </Text>
                        <Text style={styles.memberRole}>{item.role.toUpperCase()}</Text>
                      </View>
                      {isAdmin && item.role !== 'admin' && (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            style={styles.promoteBtn}
                            onPress={() => promoteToAdmin(item.user_id)}
                          >
                            <Text style={styles.promoteBtnText}>Make Admin</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.removeMemberBtn}
                            onPress={() => handleRemoveMember(item.user_id)}
                          >
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
                  contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Quick Bet Modal */}
      <Modal
        visible={betModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBetModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoiding}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border, minHeight: 200 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Place Bet</Text>
                  <TouchableOpacity onPress={() => setBetModalVisible(false)}>
                    <Text style={styles.closeModalText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                {selectedMarket && (
                  <View style={styles.betContext}>
                    <Text style={[styles.betQuestion, { color: theme.text }]}>{selectedMarket.question}</Text>
                    <View style={styles.betMeta}>
                      <Text style={styles.betBalance}>Balance: {formatCurrency(balance)}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.betInputWrapper}>
                  <TextInput
                    style={[styles.betInput, { backgroundColor: isDark ? theme.background : "#F0F2F5", color: theme.text }]}
                    placeholder="$0.00"
                    placeholderTextColor={theme.textSecondary}
                    value={betAmount}
                    onChangeText={setBetAmount}
                    keyboardType="numeric"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.betButton, isPlacingBet && { opacity: 0.5 }]}
                    onPress={handlePlaceBet}
                    disabled={isPlacingBet}
                  >
                    <Text style={styles.betButtonText}>
                      {isPlacingBet ? "..." : "Confirm Bet"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  headerInfo: {
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
    marginRight: -8,
  },
  headerAction: {
    padding: 8,
  },
  headerActionText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  messageList: { // Alias for compatibility
    paddingHorizontal: 16, 
    paddingBottom: 16,
  },
  chatArea: {
    flex: 1,
  },
  emptyMessageList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyMessages: {
    alignItems: 'center',
  },
  emptyMessagesText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
    textAlign: 'center',
  },
  marketMessageContainer: {
    marginVertical: 4,
    width: "85%",
    alignSelf: "flex-start",
  },
  marketWrapper: {
    marginBottom: 16,
  },
  marketAnnounceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  marketAnnounce: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  marketStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marketTime: {
    fontSize: 13,
    color: '#8E8E93',
  },
  optimisticMarketCard: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    opacity: 0.7,
  },
  optimisticMarketText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  optimisticMarketSubtext: {
    fontSize: 13,
    color: '#8E8E93',
  },
  marketStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  marketStatusIndicatorGray: {
    backgroundColor: '#8E8E93',
  },
  marketStatusIndicatorBlue: {
    backgroundColor: '#007AFF',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusIndicatorBlue: {
    backgroundColor: '#007AFF',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  myMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 2,
    marginLeft: 12,
  },
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarInitials: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 2,
  },
  messageBubbleLeft: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextLeft: {
    color: '#000',
  },
  messageTextRight: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeLeft: {
    color: '#8E8E93',
  },
  messageTimeRight: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 4,
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  dateSeparator: {
    alignSelf: 'center',
    marginVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  inputContextButton: {
    marginBottom: 6,
    marginRight: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  attachButton: {
    padding: 8,
  },
  attachButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: "transparent", // Wrapper handles bg
    fontSize: 16,
    padding: 0, // Reset padding in wrapper
  },
  sendButton: {
    marginBottom: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#F2F2F7",
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalKeyboardAvoiding: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: "#8E8E93",
  },
  closeModalText: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  textInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: "#8E8E93",
    marginLeft: 20,
    marginBottom: 8,
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionInput: { // Added missing class
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  optionCheckInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    justifyContent: 'center',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addOptionText: {
    marginLeft: 8,
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 15,
  },
  addOptionBtnText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  removeOptionButton: {
    padding: 8,
  },
  removeOptionText: {
    fontSize: 20,
    color: '#FF3B30',
    fontWeight: '600',
  },
  removeOptionBtn: { // Alias
    padding: 8,
  },
  durationContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 8,
    marginTop: 8,
  },
  durationSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  durationOptionSelected: {
    backgroundColor: '#007AFF',
  },
  durationOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  durationTextSelected: {
    color: '#fff',
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  durationBtnSelected: {
    backgroundColor: '#007AFF',
  },
  durationBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  durationBtnTextSelected: {
    color: '#fff',
  },
  createButton: {
    margin: 20,
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButton: {
    marginTop: 0,
    marginHorizontal: 20,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#FF3B30",
    fontSize: 17,
    fontWeight: "600",
  },
  betOptionsContainer: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  betOptionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  betOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  betOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  betOptionWinner: {
    borderColor: '#34C759',
  },
  betOptionProb: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '600',
  },
  betInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  initialBetSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  initialBetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  initialBetInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 4,
  },
  betInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    paddingVertical: 16,
    color: '#1A1A1A',
  },
  betWarningText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 6,
    marginLeft: 4,
  },
  balanceText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 13,
    marginBottom: 20,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#8E8E93',
    fontSize: 17,
    fontWeight: '600',
  },
  imagePickerButton: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 160,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  imagePickerText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  shareCodeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shareCodeLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  shareCodeBox: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  shareCodeText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
  },
  descriptionText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  descriptionInfoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  descriptionEditBox: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  descriptionInput: {
    fontSize: 15,
    color: '#000',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveDescriptionBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  saveDescriptionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  predictionsSection: {
    flex: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  accordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  accordionChevron: {
    fontSize: 16,
    color: '#C7C7CC',
  },
  accordionBody: {},
  accordionEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  marketRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  marketRowLeft: {
    flex: 1,
  },
  marketRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  marketRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F2F2F7',
  },
  marketStatusOpen: {
    color: '#34C759',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  marketStatusClosed: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 13,
    color: '#8E8E93',
  },
  promoteBtn: {
    padding: 8,
  },
  promoteBtnText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  removeMemberBtn: {
    padding: 8,
  },
  removeMemberBtnText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginVertical: 8,
  },
  adminDangerZone: {
    marginTop: 32,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  deleteGroupBtnFlat: {
    alignItems: 'center',
    padding: 16,
  },
  deleteGroupBtnTextFlat: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  betContext: {
    padding: 20,
    backgroundColor: '#F2F2F7',
    marginBottom: 10,
  },
  betQuestion: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  betMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  betBalance: {
    fontSize: 14,
    color: '#8E8E93',
  },
  betInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
  },
  betButton: {
    margin: 20,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  betButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});



