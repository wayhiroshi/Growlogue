import { apiError, getApiSession, toApiError } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
import { z } from "zod";

const endpoint = z.string().url().max(2048).refine((value) => {
  return new URL(value).protocol === "https:";
});

const subscriptionSchema = z.object({
  endpoint,
  expirationTime: z.number().nonnegative().nullable(),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256)
  })
});

const deleteSchema = z.object({ endpoint });

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = subscriptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "通知購読を登録できませんでした。", 400);
  }

  try {
    const existing = await getRuntime().prisma.pushSubscription.findUnique({
      where: { endpoint: parsed.data.endpoint },
      select: { userId: true }
    });
    if (existing && existing.userId !== session.user.id) {
      return apiError("FORBIDDEN", "この通知購読は登録できません。", 403);
    }
    const subscription = await getRuntime().prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      update: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        expiresAt:
          parsed.data.expirationTime === null
            ? null
            : new Date(parsed.data.expirationTime),
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
        disabledAt: null
      },
      create: {
        id: crypto.randomUUID(),
        userId: session.user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        expiresAt:
          parsed.data.expirationTime === null
            ? null
            : new Date(parsed.data.expirationTime),
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null
      }
    });
    return Response.json({ id: subscription.id }, { status: 201 });
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "通知購読を解除できませんでした。", 400);
  }

  const result = await getRuntime().prisma.pushSubscription.updateMany({
    where: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      disabledAt: null
    },
    data: { disabledAt: new Date() }
  });
  return Response.json({ disabled: result.count > 0 });
}
