import { AnyMarketLoader } from "@/components/AnyMarketLoader";
import { Redirect } from "expo-router";
import { useAuthContext } from "../contexts/AuthContext";
import { isAppAdmin } from "../lib/admin";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";

export default function AdminDashboardRoute() {
  const { user, hasSession, loading } = useAuthContext();

  if (loading || (hasSession && !user)) {
    return <AnyMarketLoader />;
  }

  if (!user || !isAppAdmin(user)) {
    return <Redirect href="/" />;
  }

  return <AdminDashboardScreen />;
}
