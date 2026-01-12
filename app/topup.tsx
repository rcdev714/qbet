import { TopUpScreen } from '../screens/TopUpScreen';

export default function TopUpPage() {
    // TopUpScreen still uses navigation prop internally, but we'll pass a mock
    // that uses expo-router under the hood
    return <TopUpScreen />;
}
