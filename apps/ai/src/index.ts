import {
  buildFallbackDailyReview,
  extractResponseOutputText,
  isDailyReviewSnapshot,
  isModerationFlagged,
  validateDailyReviewText,
  type DailyReviewResult,
  type DailyReviewSnapshot
} from "@growlogue/ai-coach";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";
const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
};

function fallback(
  snapshot: DailyReviewSnapshot,
  reason: string
): Response {
  console.info(JSON.stringify({ message: "ai_daily_review_fallback", reason }));
  return Response.json(buildFallbackDailyReview(snapshot), {
    headers: JSON_HEADERS
  });
}

function error(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: JSON_HEADERS }
  );
}

async function safetyIdentifier(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function gatewayHeaders(env: CloudflareEnv): HeadersInit {
  return {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "cf-aig-authorization": `Bearer ${env.AI_GATEWAY_TOKEN}`,
    "Content-Type": "application/json"
  };
}

async function requestAiReview(
  env: CloudflareEnv,
  userId: string,
  snapshot: DailyReviewSnapshot
): Promise<DailyReviewResult | null> {
  const baseUrl = env.AI_GATEWAY_URL.replace(/\/+$/u, "");
  const identifier = await safetyIdentifier(userId, env.AI_SAFETY_SECRET);
  const modelInput = {
    coreCompleted: snapshot.coreCompleted,
    totalCompleted: snapshot.totalCompleted,
    totalMissions: snapshot.totalMissions,
    earnedXp: snapshot.earnedXp,
    currentStreak: snapshot.currentStreak,
    dailyClear: snapshot.dailyClear,
    perfect: snapshot.perfect
  };
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: gatewayHeaders(env),
    body: JSON.stringify({
      model: env.AI_MODEL,
      store: false,
      safety_identifier: identifier,
      max_output_tokens: 220,
      reasoning: { effort: "low" },
      instructions:
        "あなたは英国紳士の執事Lucienです。日本語で、責めず、罪悪感を煽らず、観測された集計値だけを述べます。健康、収入、性格などを推測しません。summaryは120文字以内、nextActionは80文字以内にします。",
      input: JSON.stringify(modelInput),
      text: {
        format: {
          type: "json_schema",
          name: "daily_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              nextAction: { type: "string" }
            },
            required: ["summary", "nextAction"],
            additionalProperties: false
          }
        }
      }
    }),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) return null;
  const responseJson: unknown = await response.json();
  const outputText = extractResponseOutputText(responseJson);
  if (!outputText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return null;
  }
  const validated = validateDailyReviewText(parsed);
  if (!validated) return null;

  const moderation = await fetch(`${baseUrl}/moderations`, {
    method: "POST",
    headers: gatewayHeaders(env),
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: `${validated.summary}\n${validated.nextAction}`
    }),
    signal: AbortSignal.timeout(5_000)
  });
  if (!moderation.ok) return null;
  const moderationJson: unknown = await moderation.json();
  if (isModerationFlagged(moderationJson) !== false) return null;

  return { source: "ai", ...validated };
}

function isConfigured(env: CloudflareEnv): boolean {
  return Boolean(
    env.AI_GATEWAY_URL &&
      env.AI_GATEWAY_TOKEN &&
      env.OPENAI_API_KEY &&
      env.AI_SAFETY_SECRET
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/daily-review") {
      return error("NOT_FOUND", "AI APIが見つかりません。", 404);
    }

    const userId = request.headers.get(INTERNAL_USER_HEADER);
    if (!userId || userId.length > 128) {
      return error("UNAUTHORIZED", "内部認証が必要です。", 401);
    }

    let snapshot: unknown;
    try {
      snapshot = await request.json();
    } catch {
      return error("INVALID_JSON", "入力形式が正しくありません。", 400);
    }
    if (!isDailyReviewSnapshot(snapshot)) {
      return error("INVALID_SNAPSHOT", "日次集計が正しくありません。", 400);
    }

    if (String(env.AI_ENABLED) !== "true") {
      return fallback(snapshot, "disabled");
    }
    if (!isConfigured(env)) return fallback(snapshot, "not_configured");

    try {
      const result = await requestAiReview(env, userId, snapshot);
      return result
        ? Response.json(result, { headers: JSON_HEADERS })
        : fallback(snapshot, "invalid_or_rejected");
    } catch (caught) {
      console.error(
        JSON.stringify({
          message: "ai_daily_review_failed",
          error: caught instanceof Error ? caught.name : "UNKNOWN_ERROR"
        })
      );
      return fallback(snapshot, "request_failed");
    }
  }
} satisfies ExportedHandler<CloudflareEnv>;
