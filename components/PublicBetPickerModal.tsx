import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { feedService } from "@/services/feed.service";
import type { Market } from "@/types/market";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface PublicBetPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (market: Market) => void;
}

export function PublicBetPickerModal({
  visible,
  onClose,
  onSelect,
}: PublicBetPickerModalProps) {
  const { theme, isDark } = useTheme();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadMarkets();
    }
  }, [visible]);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const data = await feedService.getPublicMarkets(50);
      setMarkets(data);
    } catch (error) {
      console.error("Failed to load public markets:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.content,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Share a Public Prediction</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark.circle.fill" size={28} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={markets}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.marketItem,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7",
                    },
                    Platform.OS === "web" && ({ cursor: "pointer" } as any),
                  ]}
                  onPress={() => onSelect(item)}
                >
                  <Image
                    source={{ uri: item.image_url || undefined }}
                    style={styles.marketImage}
                    contentFit="cover"
                  />
                  <View style={styles.marketInfo}>
                    <Text style={[styles.question, { color: theme.text }]} numberOfLines={2}>
                      {item.question}
                    </Text>
                    <View style={styles.metadata}>
                         <Text style={[styles.category, { color: theme.textSecondary }]}>{item.category || "General"}</Text>
                    </View>
                  </View>
                  <IconSymbol name="arrow.up.right.circle" size={24} color={theme.primary} />
                </TouchableOpacity>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 40,
    maxHeight: "80%",
    minHeight: 400,
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
  closeButton: {
    padding: 4,
  },
  centerContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  marketItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  marketImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  marketInfo: {
    flex: 1,
  },
  question: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 4,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
  },
  category: {
    fontSize: 12,
    fontWeight: "400",
  }
});
