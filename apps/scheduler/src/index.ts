async function runScheduledHealthCheck(
  env: CloudflareEnv,
  scheduledTime: number
): Promise<void> {
  const result = await env.DB.prepare("SELECT 1 AS healthy").first<{
    healthy: number;
  }>();
  console.log(
    JSON.stringify({
      message: "scheduler_health_check",
      scheduledTime,
      databaseHealthy: result?.healthy === 1
    })
  );
}

export default {
  async fetch(): Promise<Response> {
    return Response.json({
      service: "growlogue-scheduler",
      status: "ok",
      phase: "notification-delivery-not-enabled"
    });
  },
  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(runScheduledHealthCheck(env, controller.scheduledTime));
  }
} satisfies ExportedHandler<CloudflareEnv>;
