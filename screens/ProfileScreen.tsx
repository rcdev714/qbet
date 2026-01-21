import { decode } from "base64-arraybuffer";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { formatCurrency } from "../lib/parimutuel";
import { supabase } from "../lib/supabase";
// Removed RootStackParamList import

export function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuthContext();
  const { theme, isDark, setMode, mode } = useTheme();
  const { balance, isVirtual } = useWalletContext();
  const [uploading, setUploading] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [updatingUsername, setUpdatingUsername] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, 
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log("Image picked:", result.assets[0].uri);
        uploadAvatar(result.assets[0]);
      }
    } catch (error: any) {
       Alert.alert("Error picking image", error.message);
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
        setUploading(true);
        console.log("Starting upload for user:", user?.id);
        if (!user) throw new Error('No user logged in');
        
        if (!asset.base64) {
            throw new Error('No image data found (base64 is missing)');
        }

        const arrayBuffer = decode(asset.base64);
        
        const ext = asset.uri.substring(asset.uri.lastIndexOf('.') + 1);
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        console.log("Uploading with filename:", fileName);
        
        const { data, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
                contentType: asset.mimeType ?? 'image/jpeg',
                upsert: true
            });
            
        if (uploadError) {
            console.error("Upload error:", uploadError);
            throw uploadError;
        }
        
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        console.log("Generated Public URL:", publicUrl);
        
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);
            
        if (updateError) {
             console.error("Database update error:", updateError);
             throw updateError;
        }
        
        console.log("User profile updated. Refreshing context...");
        await refreshUser();
        Alert.alert("Success", "Profile picture updated!");
        
    } catch (error: any) {
        console.error("Catch block error:", error);
        Alert.alert("Error uploading avatar", error.message);
    } finally {
        setUploading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!user) return;
    if (newUsername.trim() === (user.username || "")) {
      setIsEditingUsername(false);
      return;
    }

    try {
      setUpdatingUsername(true);
      const { error } = await supabase
        .from("users")
        .update({ username: newUsername.trim() })
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("This username is already taken. Please choose another one.");
        }
        throw error;
      }

      await refreshUser();
      setIsEditingUsername(false);
      Alert.alert("Success", "Username updated!");
    } catch (error: any) {
      Alert.alert("Error updating username", error.message);
    } finally {
      setUpdatingUsername(false);
    }
  };

  const startEditing = () => {
    setNewUsername(user?.username || "");
    setIsEditingUsername(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButtonLeft}>
            <Text style={[styles.backButtonText, { color: theme.primary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarInitials}>
                  {user?.username ? user.username.substring(0, 2).toUpperCase() : user?.email?.substring(0, 2).toUpperCase() ?? "U"}
                </Text>
              </View>
            )}
            <View style={[styles.editBadge, { borderColor: theme.background }]}>
              <Text style={styles.editBadgeText}>+</Text>
            </View>
            {uploading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.walletHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.walletLabel}>Total Balance</Text>
          <Text style={[styles.walletBalance, { color: theme.text }]}>{formatCurrency(balance)}</Text>
          <View style={styles.walletFooter}>
            <View style={[styles.badge, { backgroundColor: isDark ? theme.background : "#F2F2F7" }]}>
              <Text style={styles.badgeText}>
                {isVirtual ? "DEMO MODE" : "REAL MONEY"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.topUpButton, { backgroundColor: isDark ? "#003A66" : "#E7F3FF" }]}
              onPress={() => router.push("/topup" as any)}
            >
              <Text style={[styles.topUpButtonText, { color: isDark ? "#40A9FF" : "#007AFF" }]}>+ Add Funds</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={[styles.infoList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.infoLabel, { color: theme.text }]}>Username</Text>
              {isEditingUsername ? (
                <View style={styles.editUsernameContainer}>
                  <TextInput
                    style={[styles.usernameInput, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                    value={newUsername}
                    onChangeText={setNewUsername}
                    autoFocus
                    placeholder="Enter username"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    onPress={handleUpdateUsername} 
                    disabled={updatingUsername}
                    style={styles.saveButton}
                  >
                    {updatingUsername ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Text style={[styles.saveButtonText, { color: theme.primary }]}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditingUsername(false)} style={styles.cancelButton}>
                    <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={startEditing} style={styles.usernameValueContainer}>
                  <Text style={styles.infoValue}>{user?.username || "Not set"}</Text>
                  <Text style={[styles.editLabel, { color: theme.primary }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={[styles.infoLabel, { color: theme.text }]}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || user?.id}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={[styles.infoList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={[styles.infoLabel, { color: theme.text }]}>Theme</Text>
              <View style={styles.themeToggle}>
                {(['light', 'dark', 'system'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.themeOption,
                      mode === m && { backgroundColor: theme.primary }
                    ]}
                    onPress={() => setMode(m)}
                  >
                    <Text style={[
                      styles.themeOptionText,
                      { color: mode === m ? '#FFF' : theme.text }
                    ]}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signOutRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => signOut()}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7", // iOS Gray Background
    paddingBottom: Platform.OS === "ios" ? 80 : 70,
  },
  content: {
    paddingVertical: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  headerButtonLeft: {
    position: 'absolute',
    left: 12,
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: "300",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "#000",
  },
  walletHeader: {
    backgroundColor: "#fff",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
    marginBottom: 32,
  },
  walletLabel: {
    fontSize: 13,
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
    marginBottom: 8,
  },
  walletBalance: {
    fontSize: 36,
    fontWeight: "700",
    color: "#000",
    marginBottom: 16,
    letterSpacing: -1,
  },
  walletFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topUpButton: {
    backgroundColor: "#E7F3FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  topUpButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  badgeText: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "700",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  infoList: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 15,
    color: "#000",
    fontWeight: "400",
  },
  infoValue: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "400",
  },
  signOutRow: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: {
    color: "#FF3B30",
    fontSize: 17,
    fontWeight: "400",
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 2,
  },
  themeOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: -2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editUsernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 20,
  },
  usernameInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  saveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '400',
  },
  usernameValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});

