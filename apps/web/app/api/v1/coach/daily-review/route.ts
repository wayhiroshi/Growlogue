import { apiError, getApiSession } from "@/lib/api";
import { getDailyReviewSnapshot } from "@/lib/game-service";
import { buildFallbackDailyReview } from "@growlogue/ai-coach";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  }

  const snapshot = await getDailyReviewSnapshot(session.user.id);
  try {
    const { env } = getCloudflareContext();
    return await env.AI_COACH.fetch(
      new Request("https://ai.internal/daily-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_USER_HEADER]: session.user.id
        },
        body: JSON.stringify(snapshot)
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "ai_coach_service_unavailable",
        error: error instanceof Error ? error.name : "UNKNOWN_ERROR"
      })
    );
    return Response.json(buildFallbackDailyReview(snapshot), {
      headers: PRIVATE_HEADERS
    });
  }
}
