import { Redirect, useLocalSearchParams } from "expo-router";

import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { getParamString } from "@/lib/route-params";
import { GroupScreen } from "../../screens/GroupScreen";

export default function GroupPage() {
  const isDesktopWebNav = useIsDesktopWebNav();
  const params = useLocalSearchParams<{
    id?: string;
    onboarding?: string;
    invite?: string;
  }>();
  const groupId = getParamString(params.id);

  if (isDesktopWebNav && groupId) {
    const onboarding = getParamString(params.onboarding);
    const invite = getParamString(params.invite);

    return (
      <Redirect
        href={{
          pathname: "/(tabs)/groups/[id]",
          params: {
            id: groupId,
            ...(onboarding ? { onboarding } : {}),
            ...(invite ? { invite } : {}),
          },
        }}
      />
    );
  }

  return <GroupScreen />;
}
