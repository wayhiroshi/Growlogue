import { createPrisma } from "@growlogue/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

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
      autoSignIn: true
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
