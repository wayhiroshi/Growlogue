import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPrisma } from "@growlogue/db";

export function getRuntime() {
  const { env, ctx } = getCloudflareContext();
  return {
    env,
    ctx,
    db: env.DB,
    bucket: env.ASSET_BUCKET,
    prisma: createPrisma(env.DB)
  };
}
