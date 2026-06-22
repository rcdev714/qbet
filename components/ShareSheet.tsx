import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
    Modal,
    Platform,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import {
    shareService,
    type ShareEntityType,
} from "@/services/share.service";

type ShareSheetProps = {
    visible: boolean;
    onClose: () => void;
    entityType: ShareEntityType;
    entityId: string;
    title: string;
    subtitle?: string;
    shareMessage: string;
    shareSubject?: string;
    getShareUrl: () => string;
    onShareToGroup?: () => void;
    preview?: React.ReactNode;
};

export function ShareSheet({
    visible,
    onClose,
    entityType,
    entityId,
    title,
    subtitle,
    shareMessage,
    shareSubject,
    getShareUrl,
    onShareToGroup,
    preview,
}: ShareSheetProps) {
    const { theme, isDark } = useTheme();
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handleNativeShare = async () => {
        setBusy(true);
        setStatus(null);
        try {
            const baseUrl = getShareUrl();
            const shareUrl = await shareService.buildTrackedUrl(baseUrl, entityId, entityType);
            const result = await Share.share(
                Platform.OS === "ios"
                    ? { message: shareMessage, url: shareUrl }
                    : {
                        message: `${shareMessage}\n\n${shareUrl}`,
                        title: shareSubject || title,
                    },
                {
                    dialogTitle: title,
                    subject: shareSubject || title,
                },
            );

            if (result.action === Share.sharedAction) {
                setStatus("Shared!");
                onClose();
            }
        } catch (error) {
            console.error("[ShareSheet] share failed:", error);
            setStatus("Could not open share sheet.");
        } finally {
            setBusy(false);
        }
    };

    const handleCopyLink = async () => {
        setBusy(true);
        setStatus(null);
        try {
            const baseUrl = getShareUrl();
            const shareUrl = await shareService.buildTrackedUrl(baseUrl, entityId, entityType);
            if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
            }
            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setStatus("Link copied!");
            setTimeout(onClose, 700);
        } catch (error) {
            console.error("[ShareSheet] copy failed:", error);
            setStatus("Could not copy link.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[
                        styles.sheet,
                        { backgroundColor: isDark ? "#111827" : "#FFFFFF", borderColor: theme.border },
                    ]}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={styles.handle} />
                    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                    {subtitle ? (
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
                    ) : null}

                    {preview ? <View style={styles.preview}>{preview}</View> : null}

                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                        onPress={handleNativeShare}
                        disabled={busy}
                    >
                        <Text style={styles.primaryButtonText}>Share link</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.secondaryButton, { borderColor: theme.border }]}
                        onPress={handleCopyLink}
                        disabled={busy}
                    >
                        <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Copy link</Text>
                    </TouchableOpacity>

                    {onShareToGroup ? (
                        <TouchableOpacity
                            style={[styles.secondaryButton, { borderColor: theme.border }]}
                            onPress={() => {
                                onClose();
                                onShareToGroup();
                            }}
                            disabled={busy}
                        >
                            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Share to group</Text>
                        </TouchableOpacity>
                    ) : null}

                    {status ? (
                        <Text style={[styles.status, { color: theme.textSecondary }]}>{status}</Text>
                    ) : null}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === "ios" ? 34 : 24,
    },
    handle: {
        alignSelf: "center",
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: "rgba(128,128,128,0.35)",
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    preview: {
        marginBottom: 16,
        alignItems: "center",
    },
    primaryButton: {
        borderRadius: 999,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 10,
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    secondaryButton: {
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 10,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    status: {
        textAlign: "center",
        fontSize: 13,
        marginTop: 4,
    },
});
