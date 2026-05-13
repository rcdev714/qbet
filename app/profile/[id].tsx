import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ProfileScreen } from "../../screens/ProfileScreen";

export default function UserProfileRoute() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id;

  return <ProfileScreen userId={userId} />;
}
