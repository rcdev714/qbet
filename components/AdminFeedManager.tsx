import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
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
    View
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { FEED_CATEGORIES, feedService, type FeedCategory } from "../services/feed.service";
import type { Market } from "../types/market";

interface AdminFeedManagerProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = "promote" | "create" | "manage";

export function AdminFeedManager({ visible, onClose }: AdminFeedManagerProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("promote");
  const [candidates, setCandidates] = useState<Market[]>([]);
  const [activeMarkets, setActiveMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Edit State
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);

  // Create/Edit form state
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<FeedCategory>("Politics");
  const [options, setOptions] = useState(["Yes", "No"]);
  const [closesAt, setClosesAt] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default 7 days
  const [imageUrl, setImageUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

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
      setCandidates(data as Market[]);
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
        .limit(50);
      
      if (error) throw error;
      setActiveMarkets(data as Market[]);
    } catch (err) {
        console.error("Error fetching active markets:", err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (activeTab === 'manage') {
        fetchActiveMarkets();
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
      setOptions(["Yes", "No"]);
      setClosesAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setImageUrl("");
      setEditingMarketId(null);
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
      const error = await feedService.toggleMarketPublicStatus(marketId, true);
        if (error) throw error;
        
        // Remove from list locally
        setCandidates(prev => prev.filter(m => m.id !== marketId));
        Alert.alert("Success", "Market promoted to public feed");
    } catch (err) {
        console.error("Error promoting market:", err);
        Alert.alert("Error", "Failed to promote market");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSave = async () => {
    if (!question.trim()) {
      Alert.alert("Error", "Please enter a question");
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
              imageUrl: imageUrl.trim() || undefined
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

          const { error } = await feedService.createPublicMarket({
            question: question.trim(),
            category,
            options: options.filter(o => o.trim()),
            closesAt,
            imageUrl: imageUrl.trim() || undefined,
          });
    
          if (error) throw error;
    
          Alert.alert("Success", "Public market created!", [
            { text: "OK", onPress: () => {
                resetForm();
                setActiveTab("manage");
            }}
          ]);
      }
    } catch (err) {
      console.error("Error saving market:", err);
      Alert.alert("Error", "Failed to save market");
    } finally {
      setCreating(false);
    }
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
               setActiveMarkets(prev => prev.filter(m => m.id !== marketId));
               Alert.alert("Success", "Market deleted successfully");
             } catch (err) {
               console.error("Error deleting market:", err);
               Alert.alert("Error", "Failed to delete market");
             } finally {
               setProcessingId(null);
             }
          }
        }
      ]
    );
  };

  const renderMarketItem = ({ item, isManage = false }: { item: Market, isManage?: boolean }) => (
    <View style={[styles.itemContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemQuestion, { color: theme.text }]} numberOfLines={2}>
           {item.question}
        </Text>
        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
           {new Date(item.created_at || "").toLocaleDateString()} • {item.category || "General"}
        </Text>
      </View>
      
      {isManage ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
                style={[styles.promoteButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, minWidth: 60, paddingHorizontal: 12 }]}
                onPress={() => handleEdit(item)}
            >
                <Text style={[styles.promoteText, { color: theme.text }]}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
                style={[styles.promoteButton, { backgroundColor: '#FF3B30', minWidth: 40, paddingHorizontal: 10 }]}
                onPress={() => handleDelete(item.id)}
                disabled={!!processingId}
            >
                {processingId === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                )}
            </TouchableOpacity>
          </View>
      ) : (
          <TouchableOpacity
            style={[styles.promoteButton, { backgroundColor: theme.primary }]}
            onPress={() => handlePromote(item.id)}
            disabled={!!processingId}
          >
            {processingId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
            ) : (
                <Text style={styles.promoteText}>Promote</Text>
            )}
          </TouchableOpacity>
      )}
    </View>
  );

  const renderForm = () => (
    <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
      {editingMarketId && (
          <View style={[styles.editBanner, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Editing Market</Text>
              <TouchableOpacity onPress={() => {
                  resetForm();
                  setActiveTab("manage");
              }}>
                  <Text style={{ color: theme.error }}>Cancel</Text>
              </TouchableOpacity>
          </View>
      )}

      {/* Question */}
      <Text style={[styles.label, { color: theme.text }]}>Question</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        placeholder="Will X happen by Y date?"
        placeholderTextColor={theme.textSecondary}
        value={question}
        onChangeText={setQuestion}
        multiline
      />

      {/* Category */}
      <Text style={[styles.label, { color: theme.text }]}>Category</Text>
      <View style={styles.categoryRow}>
        {FEED_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              { 
                backgroundColor: category === cat ? theme.primary : theme.surface,
                borderColor: theme.border,
              }
            ]}
            onPress={() => setCategory(cat)}
          >
            <Text style={{ color: category === cat ? "#fff" : theme.text, fontWeight: "600" }}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Options - Hide when editing for now */}
      {!editingMarketId && (
        <>
            <Text style={[styles.label, { color: theme.text }]}>Options</Text>
            {options.map((opt, idx) => (
                <View key={idx} style={styles.optionRow}>
                <TextInput
                    style={[styles.optionInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={theme.textSecondary}
                    value={opt}
                    onChangeText={(val) => updateOption(idx, val)}
                />
                {options.length > 2 && (
                    <TouchableOpacity onPress={() => removeOption(idx)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
                </View>
            ))}
            <TouchableOpacity style={[styles.addOptionBtn, { borderColor: theme.border }]} onPress={addOption}>
                <Ionicons name="add" size={20} color={theme.primary} />
                <Text style={{ color: theme.primary, marginLeft: 4 }}>Add Option</Text>
            </TouchableOpacity>
        </>
      )}

      {/* Close Date */}
      <Text style={[styles.label, { color: theme.text }]}>Close Date</Text>
      <TouchableOpacity 
        style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons name="calendar-outline" size={20} color={theme.text} />
        <Text style={[styles.dateText, { color: theme.text }]}>
          {closesAt.toLocaleDateString()} at {closesAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
        />
      )}

      {/* Image URL & Phone Preview */}
      <Text style={[styles.label, { color: theme.text }]}>Market Visual</Text>
      <View style={[styles.imageManagementCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Paste target image URL..."
            placeholderTextColor={theme.textSecondary}
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          
          <View style={styles.previewCenter}>
              <View style={styles.phoneFrame}>
                  {imageUrl ? (
                      <Image 
                        source={{ uri: imageUrl }} 
                        style={styles.fullImage} 
                        contentFit="cover"
                      />
                  ) : (
                      <View style={styles.emptyFrame}>
                          <Ionicons name="camera-outline" size={32} color={theme.textSecondary} />
                          <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 8 }}>9:16 PORTRAIT</Text>
                      </View>
                  )}
                  <View style={styles.frameOverlay}>
                      <Text style={styles.frameQuestion} numberOfLines={2}>{question || "Your question..."}</Text>
                  </View>
              </View>
              <Text style={styles.helperText}>Portrait background (Phone dimensions)</Text>
          </View>
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary, opacity: creating ? 0.7 : 1 }]}
        onPress={handleSave}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>
              {editingMarketId ? "Update Market" : "Create Public Market"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Feed Manager (Admin)</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
             <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === "promote" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("promote")}
          >
            <Text style={[styles.tabText, { color: activeTab === "promote" ? theme.primary : theme.textSecondary }]}>
              Promote
            </Text>
          </TouchableOpacity>
            
          <TouchableOpacity 
            style={[styles.tab, activeTab === "manage" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("manage")}
          >
            <Text style={[styles.tabText, { color: activeTab === "manage" ? theme.primary : theme.textSecondary }]}>
              Manage
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === "create" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("create")}
          >
            <Text style={[styles.tabText, { color: activeTab === "create" ? theme.primary : theme.textSecondary }]}>
              {editingMarketId ? "Edit" : "Create New"}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "create" ? (
             <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
                {renderForm()}
             </KeyboardAvoidingView>
        ) : (
          <FlatList
            data={activeTab === 'manage' ? activeMarkets : candidates}
            renderItem={(props) => renderMarketItem({ ...props, isManage: activeTab === 'manage' })}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={activeTab === 'manage' ? fetchActiveMarkets : fetchCandidates}
            ListEmptyComponent={
                <View style={styles.center}>
                    <Text style={{ color: theme.textSecondary }}>
                        {activeTab === 'manage' ? "No active public markets" : "No candidates found"}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
     padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
  },
  listContent: {
      padding: 16,
      gap: 12
  },
  itemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
  },
  itemInfo: {
      flex: 1,
      marginRight: 12
  },
  itemQuestion: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4
  },
  itemMeta: {
      fontSize: 12,
  },
  promoteButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 80,
      alignItems: 'center'
  },
  promoteText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 13
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 12,
      marginBottom: 16,
      borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  imageManagementCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  previewCenter: {
    alignItems: 'center',
    marginTop: 16,
  },
  phoneFrame: {
    width: 120,
    aspectRatio: 9 / 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#333',
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  emptyFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#444',
    margin: 4,
    borderRadius: 12,
  },
  frameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    justifyContent: 'flex-end',
  },
  frameQuestion: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 11,
    marginTop: 12,
    fontWeight: '500',
  },
});
