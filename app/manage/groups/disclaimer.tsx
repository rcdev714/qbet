import { GroupAdminDisclaimerScreen } from "@/components/group-admin/GroupAdminDisclaimerScreen";
import { useGroupAdminConsole } from "@/hooks/useGroupAdminConsole";
import { useRouter } from "expo-router";
import React, { useState } from "react";

export default function ManageGroupsDisclaimerRoute() {
  const router = useRouter();
  const { acceptDisclaimer } = useGroupAdminConsole();
  const [submitting, setSubmitting] = useState(false);

  return (
    <GroupAdminDisclaimerScreen
      submitting={submitting}
      onAccept={async () => {
        setSubmitting(true);
        const ok = await acceptDisclaimer();
        setSubmitting(false);
        if (ok) router.replace("/manage/groups" as never);
        return ok;
      }}
    />
  );
}
