import { Redirect } from "expo-router";
import { useAuthContext } from "../contexts/AuthContext";
import { isAdminEmail } from "../lib/admin";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";

export default function AdminDashboardRoute() {
  const { user } = useAuthContext();

  if (!user || !isAdminEmail(user?.email)) {
    return <Redirect href="/" />;
  }

  return <AdminDashboardScreen />;
}
