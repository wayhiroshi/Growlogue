import {
  buildShareCardSnapshot,
  isShareCardSnapshot,
  renderPublicSharePage,
  renderShareCardHtml,
  type ShareCardOptions,
  type ShareCardSnapshot
} from "./share-card-domain";
import { getRuntime } from "./runtime";
import { getWeeklyReport } from "./weekly-report-service";

const MAX_CARD_BYTES = 5 * 1024 * 1024;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

interface WeeklyReportRow {
  id: string;
  imageKey: string | null;
}

interface ShareRow {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  summaryJson: string;
  imageKey: string | null;
}

interface ActiveShareRow {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
}

function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) =>
    String.fromCharCode(byte)
  ).join("");
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function safeOrigin(origin: string): string {
  const url = new URL(origin);
  return url.origin;
}

function shareUrls(origin: string, token: string) {
  const base = safeOrigin(origin);
  return {
    url: `${base}/share/${token}`,
    imageUrl: `${base}/share/${token}/image`
  };
}

async function lookupPublicShare(token: string): Promise<{
  row: ShareRow;
  snapshot: ShareCardSnapshot;
} | null> {
  if (!tokenPattern.test(token)) return null;
  const { db } = getRuntime();
  const row = await db
    .prepare(
      `SELECT s."id", s."expiresAt", s."revokedAt",
              w."summaryJson", w."imageKey"
       FROM "ShareLink" s
       JOIN "WeeklyReport" w ON w."id" = s."reportId"
       WHERE s."tokenHash" = ?
       LIMIT 1`
    )
    .bind(await sha256(token))
    .first<ShareRow>();
  if (
    !row ||
    row.revokedAt ||
    Date.parse(row.expiresAt) <= Date.now() ||
    !row.imageKey
  ) {
    return null;
  }
  try {
    const snapshot: unknown = JSON.parse(row.summaryJson);
    return isShareCardSnapshot(snapshot) ? { row, snapshot } : null;
  } catch {
    return null;
  }
}

export async function createWeeklyShareCard(
  userId: string,
  input: ShareCardOptions & {
    weekStart: string;
    expiresInDays: 1 | 7 | 30;
  },
  origin: string
) {
  const { db, env, ctx } = getRuntime();
  const report = await getWeeklyReport(userId, input.weekStart);
  const snapshot = buildShareCardSnapshot(report, input);
  const html = renderShareCardHtml(snapshot);
  const renderResponse = await env.BROWSER.quickAction("screenshot", {
    html,
    viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
    selector: "#share-card",
    setJavaScriptEnabled: false,
    cacheTTL: 0,
    screenshotOptions: {
      type: "png",
      encoding: "binary",
      omitBackground: false
    }
  });
  if (
    !renderResponse.ok ||
    renderResponse.headers.get("content-type") !== "image/png"
  ) {
    await renderResponse.body?.cancel();
    throw new Error("SHARE_CARD_RENDER_FAILED");
  }
  const png = await renderResponse.arrayBuffer();
  if (png.byteLength === 0 || png.byteLength > MAX_CARD_BYTES) {
    throw new Error("SHARE_CARD_RENDER_FAILED");
  }

  const existing = await db
    .prepare(
      `SELECT "id", "imageKey" FROM "WeeklyReport"
       WHERE "userId" = ? AND "weekStart" = ?`
    )
    .bind(userId, report.weekStart)
    .first<WeeklyReportRow>();
  const reportId = existing?.id ?? crypto.randomUUID();
  const shareId = crypto.randomUUID();
  const token = createToken();
  const tokenHash = await sha256(token);
  const imageKey = `weekly/${report.weekStart}/${crypto.randomUUID()}.png`;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const permissions = JSON.stringify({
    version: 1,
    fields: [
      "summary",
      ...(input.includeCategoryXp ? ["categoryXp"] : []),
      ...(input.includeStreak ? ["streak"] : [])
    ]
  });

  await env.SHARE_CARDS.put(imageKey, png, {
    httpMetadata: {
      contentType: "image/png",
      cacheControl: "private, no-store"
    },
    customMetadata: {
      kind: "weekly-report",
      weekStart: report.weekStart
    }
  });

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO "WeeklyReport"
             ("id", "userId", "weekStart", "summaryJson", "imageKey", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT("userId", "weekStart") DO UPDATE SET
             "summaryJson" = excluded."summaryJson",
             "imageKey" = excluded."imageKey"`
        )
        .bind(
          reportId,
          userId,
          report.weekStart,
          JSON.stringify(snapshot),
          imageKey,
          now.toISOString()
        ),
      db
        .prepare(
          `UPDATE "ShareLink" SET "revokedAt" = ?
           WHERE "userId" = ? AND "reportId" = ? AND "revokedAt" IS NULL`
        )
        .bind(now.toISOString(), userId, reportId),
      db
        .prepare(
          `INSERT INTO "ShareLink"
             ("id", "userId", "tokenHash", "reportId", "permissions",
              "expiresAt", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          shareId,
          userId,
          tokenHash,
          reportId,
          permissions,
          expiresAt,
          now.toISOString()
        )
    ]);
  } catch (error) {
    await env.SHARE_CARDS.delete(imageKey);
    throw error;
  }

  if (existing?.imageKey && existing.imageKey !== imageKey) {
    ctx.waitUntil(env.SHARE_CARDS.delete(existing.imageKey));
  }
  const urls = shareUrls(origin, token);
  console.log(
    JSON.stringify({
      message: "weekly_share_card_created",
      reportId,
      shareId,
      weekStart: report.weekStart,
      bytes: png.byteLength,
      browserMs: renderResponse.headers.get("x-browser-ms-used")
    })
  );
  return { id: shareId, expiresAt, ...urls };
}

export async function getActiveWeeklyShare(
  userId: string,
  weekStart: string
) {
  const { db } = getRuntime();
  const row = await db
    .prepare(
      `SELECT s."id", s."expiresAt", s."revokedAt"
       FROM "ShareLink" s
       JOIN "WeeklyReport" w ON w."id" = s."reportId"
       WHERE s."userId" = ? AND w."weekStart" = ?
         AND s."revokedAt" IS NULL AND s."expiresAt" > ?
       ORDER BY s."createdAt" DESC LIMIT 1`
    )
    .bind(userId, weekStart, new Date().toISOString())
    .first<ActiveShareRow>();
  if (!row) return null;
  return {
    id: row.id,
    expiresAt: row.expiresAt,
    url: null,
    imageUrl: null,
    note: "再表示後は安全のためURL原文を復元できません。新しく作り直してください。"
  };
}

export async function revokeWeeklyShare(userId: string, shareId: string) {
  const { db } = getRuntime();
  const result = await db
    .prepare(
      `UPDATE "ShareLink" SET "revokedAt" = COALESCE("revokedAt", ?)
       WHERE "id" = ? AND "userId" = ?`
    )
    .bind(new Date().toISOString(), shareId, userId)
    .run();
  if ((result.meta.changes ?? 0) === 0) {
    throw new Error("SHARE_LINK_NOT_FOUND");
  }
  return { id: shareId, revoked: true };
}

export async function getPublicSharePage(
  token: string,
  origin: string
): Promise<string | null> {
  const share = await lookupPublicShare(token);
  if (!share) return null;
  return renderPublicSharePage(
    share.snapshot,
    shareUrls(origin, token).imageUrl,
    share.row.expiresAt
  );
}

export async function getPublicShareImage(
  token: string
): Promise<Response | null> {
  const share = await lookupPublicShare(token);
  if (!share?.row.imageKey) return null;
  const { env } = getRuntime();
  const object = await env.SHARE_CARDS.get(share.row.imageKey);
  if (!object?.body) return null;
  const headers = new Headers({
    "Content-Type": "image/png",
    "Cache-Control": "private, no-store",
    "Content-Length": String(object.size),
    ETag: object.httpEtag,
    "X-Content-Type-Options": "nosniff"
  });
  return new Response(object.body, { headers });
}
