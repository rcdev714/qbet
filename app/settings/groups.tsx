import { Redirect } from "expo-router";

export default function SettingsGroupsRedirect() {
  return <Redirect href={"/manage/groups" as never} />;
}
