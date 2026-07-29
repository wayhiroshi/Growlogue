import { apiError, getApiSession } from "@/lib/api";
import { ensureUserFoundation } from "@/lib/game-service";
import { isMonthKey } from "@growlogue/reports";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  }

  const month = new URL(request.url).searchParams.get("month");
  if (month && !isMonthKey(month)) {
    return apiError(
      "INVALID_MONTH",
      "月はYYYY-MM形式で指定してください。",
      400
    );
  }

  const internalUrl = new URL("https://reports.internal/monthly");
  if (month) internalUrl.searchParams.set("month", month);

  try {
    await ensureUserFoundation(session.user.id);
    const { env } = getCloudflareContext();
    return await env.REPORTS.fetch(
      new Request(internalUrl, {
        method: "GET",
        headers: {
          [INTERNAL_USER_HEADER]: session.user.id
        }
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "reports_service_unavailable",
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      })
    );
    return apiError(
      "REPORTS_UNAVAILABLE",
      "月間レポートを読み込めませんでした。",
      503
    );
  }
}
