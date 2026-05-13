import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const SignupBanner: React.FC = () => {
    const { theme, isDark } = useTheme();
    const router = useRouter();

    if (Platform.OS !== 'web') return null;

    return (
        <View style={styles.container}>
            <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.blurContainer}>
                <View style={styles.content}>
                    <Text style={[styles.text, { color: isDark ? '#fff' : '#000' }]}>
                        Predict the future and win $$ on AnyMarket. Sign up today!
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primary }]}
                        onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })}
                    >
                        <Text style={styles.buttonText}>
                            Join Now
                        </Text>
                    </TouchableOpacity>
                </View>
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 1000,
        // Make it float slightly if desired, or stick to top
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    blurContainer: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        maxWidth: 1440,
        alignSelf: 'center',
        width: '100%',
        flexWrap: 'wrap',
    },
    text: {
        fontSize: 14,
        fontWeight: '400',
        textAlign: 'center',
        flexShrink: 1,
    },
    button: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20, // More rounded for apple style
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
