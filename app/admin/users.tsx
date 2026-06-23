import { useAuthContext } from "@/contexts/AuthContext";
import { isAppAdmin } from "@/lib/admin";
import AdminUsersScreen from "@/screens/AdminUsersScreen";
import { Redirect } from "expo-router";

export default function AdminUsersRoute() {
  const { user } = useAuthContext();

  if (!user || !isAppAdmin(user)) {
    return <Redirect href="/" />;
  }

  return <AdminUsersScreen />;
}
