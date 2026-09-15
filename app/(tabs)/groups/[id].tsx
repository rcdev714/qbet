import { GroupScreen } from "@/screens/GroupScreen";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";

export default function GroupDetailPage() {
  const isDesktopWebNav = useIsDesktopWebNav();

  return <GroupScreen embedded={isDesktopWebNav} />;
}
