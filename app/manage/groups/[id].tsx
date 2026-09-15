import { AnymarktLoader } from "@/components/AnymarktLoader";
import { useGroupAdminConsole } from "@/hooks/useGroupAdminConsole";
import { GroupAdminDetailScreen } from "@/screens/GroupAdminDetailScreen";
import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

export default function ManageGroupDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, loading, hasAcknowledgment } = useGroupAdminConsole();

  if (loading || hasAcknowledgment === null) {
    return <AnymarktLoader />;
  }

  if (!hasAcknowledgment) {
    return <Redirect href={"/manage/groups/disclaimer" as never} />;
  }

  if (!id || typeof id !== "string") {
    return <Redirect href={"/manage/groups" as never} />;
  }

  return <GroupAdminDetailScreen groupId={id} groups={groups} />;
}
