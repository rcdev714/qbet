import type { Database } from "./database";

export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupSummary = Pick<
  Group,
  "id" | "name" | "description" | "admin_id" | "created_at"
>;
export type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"];
export type GroupUpdate = Database["public"]["Tables"]["groups"]["Update"];

export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
export type GroupMemberInsert = Database["public"]["Tables"]["group_members"]["Insert"];
export type GroupMemberUpdate = Database["public"]["Tables"]["group_members"]["Update"];

export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type InviteInsert = Database["public"]["Tables"]["invites"]["Insert"];
export type InviteUpdate = Database["public"]["Tables"]["invites"]["Update"];


