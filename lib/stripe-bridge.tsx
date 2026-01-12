import React from 'react';
import { Alert, Platform } from 'react-native';

export const isStripeNativeAvailable = false;

export const useStripe = () => ({
    createToken: async () => {
        if (Platform.OS === 'web') alert('Note: Payments are currently enabled for iOS/Android only. Contact support for web payments.');
        return { token: null, error: { message: 'Stripe not available on web' } };
    },
    initPaymentSheet: async (_options: any) => ({ error: { message: 'Stripe not available on web' } }),
    presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
});

export const StripeProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children} </>;
};
