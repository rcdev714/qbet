import { GroupsDetailPlaceholder } from "@/components/groups/GroupsDetailPlaceholder";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { DirectMessagesScreen } from "@/screens/DirectMessagesScreen";

export default function GroupsIndexPage() {
  const isDesktopWebNav = useIsDesktopWebNav();

  if (isDesktopWebNav) {
    return <GroupsDetailPlaceholder />;
  }

  return <DirectMessagesScreen />;
}
