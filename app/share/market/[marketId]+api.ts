import {
  getMarketSharePreview,
  htmlResponse,
  renderSharePreviewHTML,
} from "@/lib/share-preview";

type RouteParams = {
  marketId: string;
};

export async function GET(request: Request, { marketId }: RouteParams) {
  try {
    const url = new URL(request.url);
    const preview = await getMarketSharePreview(
      marketId,
      url.searchParams.get("group"),
    );

    return htmlResponse(renderSharePreviewHTML(preview));
  } catch (error) {
    console.error("[share/market] Failed to render preview:", error);
    return htmlResponse("Share preview unavailable.", 500);
  }
}
