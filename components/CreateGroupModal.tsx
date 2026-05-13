import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { CodeInput } from "./ui/CodeInput";
import { IconSymbol } from "./ui/icon-symbol";

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  loading: boolean;
}

export function CreateGroupModal({ visible, onClose, onCreate, onJoin, loading }: CreateGroupModalProps) {
  const { theme, isDark } = useTheme();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Reset state when opening
  useEffect(() => {
    if (visible) {
      setMode('create');
      setName("");
      setDescription("");
      setJoinCode("");
    }
  }, [visible]);

  const handleSubmit = () => {
    if (mode === 'create') {
      if (!name.trim()) return;
      onCreate(name, description);
    } else {
      if (joinCode.length !== 6) return;
      onJoin(joinCode);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardContainer}
            >
              <TouchableWithoutFeedback>
                <View style={[styles.container, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', shadowColor: theme.text }]}>
                  
                  {/* Header */}
                  <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>
                      {mode === 'create' ? "New Group" : "Join Group"}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                      <IconSymbol name="xmark" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Tabs */}
                  <View style={[styles.tabs, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                    <TouchableOpacity
                      style={[styles.tab, mode === 'create' && { backgroundColor: theme.background, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }]}
                      onPress={() => setMode('create')}
                    >
                      <Text style={[styles.tabText, { color: theme.text, fontWeight: mode === 'create' ? '600' : '400' }]}>Create</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tab, mode === 'join' && { backgroundColor: theme.background, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }]}
                      onPress={() => setMode('join')}
                    >
                      <Text style={[styles.tabText, { color: theme.text, fontWeight: mode === 'join' ? '600' : '400' }]}>Join</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Content */}
                  <View style={styles.content}>
                    {mode === 'create' ? (
                      <>
                        <View style={styles.inputContainer}>
                          <Text style={[styles.label, { color: theme.textSecondary }]}>NAME</Text>
                          <TextInput
                            style={[styles.input, { color: theme.text, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                            placeholder="e.g. Sunday Football"
                            placeholderTextColor={theme.textSecondary}
                            value={name}
                            onChangeText={setName}
                            autoFocus
                          />
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={[styles.label, { color: theme.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
                          <TextInput
                            style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                            placeholder="What this group is about..."
                            placeholderTextColor={theme.textSecondary}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                          />
                        </View>
                      </>
                    ) : (
                      <View style={styles.joinContainer}>
                        <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 12 }]}>ENTER INVITE CODE</Text>
                        <CodeInput
                          value={joinCode}
                          onChange={setJoinCode}
                          length={6}
                          autoFocus
                        />
                      </View>
                    )}
                  </View>

                  {/* Footer */}
                  <View style={styles.footer}>
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        { backgroundColor: theme.primary },
                        ((mode === 'create' && !name.trim()) || (mode === 'join' && joinCode.length !== 6)) && styles.disabledButton
                      ]}
                      onPress={handleSubmit}
                      disabled={loading || (mode === 'create' && !name.trim()) || (mode === 'join' && joinCode.length !== 6)}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          {mode === 'create' ? "Create Group" : "Join Group"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabText: {
    fontSize: 14,
  },
  content: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  joinContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footer: {
    flexDirection: 'row',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
