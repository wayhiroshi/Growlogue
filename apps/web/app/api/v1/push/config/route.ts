import { apiError, getApiSession } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  return Response.json({
    publicKey: getRuntime().env.VAPID_PUBLIC_KEY
  });
}
