import {
  AppButton,
  AppInput,
  AppText,
  FieldGroup,
} from "@/components/ui";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CodeInput } from "@/components/ui/CodeInput";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  loading: boolean;
}

export function CreateGroupModal({
  visible,
  onClose,
  onCreate,
  onJoin,
  loading,
}: CreateGroupModalProps) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (visible) {
      setMode("create");
      setName("");
      setDescription("");
      setJoinCode("");
    }
  }, [visible]);

  const handleSubmit = () => {
    if (mode === "create") {
      if (!name.trim()) return;
      onCreate(name, description);
    } else {
      if (joinCode.length !== 6) return;
      onJoin(joinCode);
    }
  };

  const submitDisabled =
    loading ||
    (mode === "create" && !name.trim()) ||
    (mode === "join" && joinCode.length !== 6);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardContainer}
            >
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.container,
                    {
                      backgroundColor: theme.surface,
                      borderRadius: theme.radius.lg,
                      ...theme.elevation("md"),
                    },
                  ]}
                >
                  <ModalHeader
                    title={mode === "create" ? "New Group" : "Join Group"}
                    onClose={onClose}
                  />

                  <View style={styles.body}>
                    <SegmentedControl
                      value={mode}
                      segments={[
                        { value: "create", label: "Create" },
                        { value: "join", label: "Join" },
                      ]}
                      onChange={setMode}
                    />

                    <View style={styles.content}>
                      {mode === "create" ? (
                        <FieldGroup>
                          <AppInput
                            label="Name"
                            placeholder="e.g. Sunday Football"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                          />
                          <AppInput
                            label="Description (optional)"
                            placeholder="What this group is about..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            style={styles.textArea}
                          />
                        </FieldGroup>
                      ) : (
                        <View style={styles.joinContainer}>
                          <AppText variant="label" color="secondary" style={styles.joinLabel}>
                            Enter invite code
                          </AppText>
                          <CodeInput
                            value={joinCode}
                            onChange={setJoinCode}
                            length={6}
                            autoFocus
                          />
                        </View>
                      )}
                    </View>

                    <AppButton
                      title={mode === "create" ? "Create Group" : "Join Group"}
                      loading={loading}
                      disabled={submitDisabled}
                      onPress={handleSubmit}
                    />
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  keyboardContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  body: {
    padding: 20,
    gap: 20,
  },
  content: {
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  joinContainer: {
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  joinLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
