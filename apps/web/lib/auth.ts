import { createPrisma } from "@growlogue/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { sendPasswordResetEmail } from "@/lib/auth-email";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getAuth() {
  const { env } = getCloudflareContext();
  const ownerEmail = requiredEnvironment("OWNER_EMAIL").trim().toLowerCase();
  const appUrl =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  return betterAuth({
    appName: "Growlogue",
    baseURL: appUrl,
    secret: requiredEnvironment("BETTER_AUTH_SECRET"),
    database: prismaAdapter(createPrisma(env.DB), {
      provider: "sqlite"
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        if (user.email.trim().toLowerCase() !== ownerEmail) return;
        if (new URL(url).origin !== new URL(appUrl).origin) {
          throw new Error("Invalid password reset URL origin");
        }
        await sendPasswordResetEmail({
          apiKey: requiredEnvironment("RESEND_API_KEY"),
          from:
            process.env.AUTH_EMAIL_FROM ??
            "Growlogue <growlogue@notify.aether42.com>",
          replyTo: ownerEmail,
          to: user.email,
          url,
          token
        });
      }
    },
    advanced: {
      database: {
        generateId: "uuid"
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"]
      },
      cookiePrefix: "growlogue"
    },
    trustedOrigins: [appUrl],
    rateLimit: {
      enabled: true,
      customRules: {
        "/request-password-reset": {
          window: 15 * 60,
          max: 3
        }
      }
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-up/email") return;
        const requestedEmail =
          typeof context.body?.email === "string"
            ? context.body.email.trim().toLowerCase()
            : "";
        if (requestedEmail !== ownerEmail) {
          throw new APIError("FORBIDDEN", {
            message: "現在は所有者本人だけが登録できます。"
          });
        }
      })
    },
    telemetry: {
      enabled: false
    },
    plugins: [nextCookies()]
  });
}

export type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>
>;
