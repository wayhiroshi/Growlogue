import { apiError, getApiSession, toApiError } from "@/lib/api";
import { getDashboard } from "@/lib/game-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  try {
    return Response.json(await getDashboard(session.user.id));
  } catch (error) {
    return toApiError(error);
  }
}
