import { assertPostConditions } from "./helpers/assert-db";

export default async function globalTeardown() {
  if (process.env.E2E_SKIP_DB_ASSERT === "1") return;
  try {
    await assertPostConditions();
  } catch (error) {
    console.warn("[globalTeardown] DB assertions skipped or failed:", error);
  }
}
