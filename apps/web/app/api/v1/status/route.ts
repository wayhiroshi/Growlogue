import { apiError, getApiSession, toApiError } from "@/lib/api";
import { getDashboard } from "@/lib/game-service";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  try {
    const dashboard = await getDashboard(session.user.id);
    return Response.json({
      progress: dashboard.progress,
      streak: dashboard.streak,
      statuses: dashboard.statuses
    });
  } catch (error) {
    return toApiError(error);
  }
}
