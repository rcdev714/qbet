import React from 'react';

export const isStripeNativeAvailable = false;

export const useStripe = () => ({
    createToken: async () => ({ token: null, error: { message: 'Stripe not available on web' } }),
    initPaymentSheet: async (_options: any) => ({ error: { message: 'Stripe not available on web' } }),
    presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
});

export const StripeProvider = ({
    children,
    publishableKey: _publishableKey
}: {
    children: React.ReactNode;
    publishableKey?: string;
}) => {
    return children as React.ReactElement;
};
