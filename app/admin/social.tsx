import { AnymarktLoader } from "@/components/AnymarktLoader";
import { useAuthContext } from "@/contexts/AuthContext";
import { isAppAdmin } from "@/lib/admin";
import AdminSocialScreen from "@/screens/AdminSocialScreen";
import { Redirect } from "expo-router";

export default function AdminSocialRoute() {
  const { user, hasSession, loading } = useAuthContext();

  if (loading || (hasSession && !user)) {
    return <AnymarktLoader />;
  }

  if (!user || !isAppAdmin(user)) {
    return <Redirect href="/" />;
  }

  return <AdminSocialScreen />;
}
