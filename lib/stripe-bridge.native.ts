import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { NativeModules } from 'react-native';

const isStripeNativeAvailable = !!(NativeModules as Record<string, unknown>)?.StripeSdk;

export { StripeProvider, useStripe, isStripeNativeAvailable };
