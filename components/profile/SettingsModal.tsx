import { RulesModal } from '@/components/profile/RulesModal';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  onUpdateUsername: (newUsername: string) => Promise<void>;
  onSignOut: () => void;
  onUpdateAvatar: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
}

export function SettingsModal({ visible, onClose, user, onUpdateUsername, onSignOut, onUpdateAvatar }: SettingsModalProps) {
  const { theme, isDark, setMode, mode } = useTheme();
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [isRulesVisible, setIsRulesVisible] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onUpdateUsername(newUsername);
    setLoading(false);
    onClose();
  };
  
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // crop to square
        aspect: [1, 1],
        quality: 0.5,
        base64: true, 
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarLoading(true);
        await onUpdateAvatar(result.assets[0]);
        setAvatarLoading(false);
      }
    } catch (error: any) {
       Alert.alert("Error picking image", error.message);
       setAvatarLoading(false);
    }
  };

  return (
    <>
      <Modal animationType="slide" transparent={false} visible={visible} presentationStyle="pageSheet">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, Platform.OS === 'web' && { cursor: 'pointer' } as any]}>
              <Text style={[styles.closeText, { color: theme.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Account</Text>
              
              <View style={[styles.avatarRow, { backgroundColor: theme.surface }]}>
                  <TouchableOpacity onPress={pickImage} style={[styles.avatarContainer, Platform.OS === 'web' && { cursor: 'pointer' } as any]}>
                       {user?.avatar_url ? (
                          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                       ) : (
                          <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? theme.surface : theme.primary, borderColor: isDark ? theme.primary : 'transparent', borderWidth: isDark ? 2 : 0 }]}>
                               <Text style={{color: '#fff', fontSize: 24, fontWeight: '600'}}>
                                   {user?.username?.substring(0,2).toUpperCase() || "U"}
                               </Text>
                          </View>
                       )}
                       <Text style={[styles.changePhotoText, { color: theme.primary }]}>Change Photo</Text>
                       {avatarLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color={theme.primary} />}
                  </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                 <Text style={[styles.label, { color: theme.text }]}>Username</Text>
                 <TextInput 
                   style={[styles.input, { color: theme.text }, Platform.OS === 'web' && { cursor: 'text' } as any]}
                   value={newUsername}
                   onChangeText={setNewUsername}
                   placeholder="Username"
                 />
              </View>
              <View style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                 <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                 <Text style={[styles.infoValue, { color: theme.textSecondary }]}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Appearance</Text>
              <View style={[styles.themeRow, { backgroundColor: theme.surface }]}>
                   {(['light', 'dark', 'system'] as const).map((m) => (
                      <TouchableOpacity
                          key={m}
                          style={[
                              styles.themeOption,
                              mode === m && { backgroundColor: isDark ? theme.surface : theme.primary, borderColor: isDark ? theme.primary : 'transparent', borderWidth: isDark ? 1 : 0 },
                              Platform.OS === 'web' && { cursor: 'pointer' } as any
                          ]}
                          onPress={() => setMode(m)}
                      >
                          <Text style={[styles.themeText, { color: mode === m ? '#fff' : theme.text }]}>
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                          </Text>
                      </TouchableOpacity>
                   ))}
              </View>
            </View>

            <View style={styles.section}> 
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>About</Text>
              <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.surface }, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
                  onPress={() => setIsRulesVisible(true)}
              >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>📖</Text>
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Rules</Text>
                  <Text style={{ fontSize: 16, color: theme.textSecondary, marginLeft: 'auto' }}>→</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: isDark ? theme.surface : theme.primary, borderColor: isDark ? theme.primary : 'transparent', borderWidth: isDark ? 1 : 0 }, Platform.OS === 'web' && { cursor: 'pointer' } as any]} onPress={handleSave}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveButtonText, { color: isDark ? theme.primary : '#fff' }]}>Save Changes</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.signOutButton, { backgroundColor: theme.surface }, Platform.OS === 'web' && { cursor: 'pointer' } as any]} onPress={onSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
          <RulesModal visible={isRulesVisible} onClose={() => setIsRulesVisible(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  avatarRow: {
      alignItems: 'center',
      padding: 20,
      borderRadius: 12,
      marginBottom: 16,
  },
  avatarContainer: {
      alignItems: 'center',
  },
  avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 8,
  },
  avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 8,
      justifyContent: 'center',
      alignItems: 'center',
  },
  changePhotoText: {
      fontSize: 15,
      fontWeight: '400',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  label: {
      fontSize: 16,
      width: 100,
  },
  input: {
      flex: 1,
      fontSize: 16,
      textAlign: 'right',
  },
  infoValue: {
      fontSize: 16,
  },
  themeRow: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 8,
  },
  themeOption: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
  },
  themeText: {
      fontWeight: '400',
  },
  saveButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 12,
  },
  saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
  },
  signOutButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
  },
  signOutText: {
      color: '#FF3B30',
      fontSize: 16,
      fontWeight: '600',
  },
  menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
  },
  menuItemText: {
      fontSize: 16,
      fontWeight: '400',
  },
});
