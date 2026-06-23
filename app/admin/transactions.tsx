import { AnyMarketLoader } from "@/components/AnyMarketLoader";
import { useAuthContext } from "@/contexts/AuthContext";
import { isAppAdmin } from "@/lib/admin";
import AdminTransactionsScreen from "@/screens/AdminTransactionsScreen";
import { Redirect } from "expo-router";

export default function AdminTransactionsRoute() {
  const { user, hasSession, loading } = useAuthContext();

  if (loading || (hasSession && !user)) {
    return <AnyMarketLoader />;
  }

  if (!user || !isAppAdmin(user)) {
    return <Redirect href="/" />;
  }

  return <AdminTransactionsScreen />;
}
