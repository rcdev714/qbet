import {
  getGroupSharePreview,
  htmlResponse,
  renderSharePreviewHTML,
} from "@/lib/share-preview";

type RouteParams = {
  groupId: string;
};

export async function GET(_request: Request, { groupId }: RouteParams) {
  try {
    const preview = await getGroupSharePreview(groupId);

    return htmlResponse(renderSharePreviewHTML(preview));
  } catch (error) {
    console.error("[share/group] Failed to render preview:", error);
    return htmlResponse("Share preview unavailable.", 500);
  }
}
