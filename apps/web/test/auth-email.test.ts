import { describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "../lib/auth-email";

describe("password reset email", () => {
  it("sends plain text and HTML with an idempotency key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-id" }), { status: 200 })
    );

    await sendPasswordResetEmail({
      apiKey: "  test-key\n",
      from: "Growlogue <growlogue@notify.aether42.com>",
      replyTo: "owner@example.com",
      to: "owner@example.com",
      url: "https://growlogue.example/reset?token=<secret>",
      token: "secret-token",
      fetcher
    });

    const [, request] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(request?.headers);
    const body = JSON.parse(String(request?.body)) as {
      html: string;
      text: string;
    };
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(headers.get("Idempotency-Key")).toMatch(/^password-reset-[a-f0-9]{64}$/);
    expect(body.text).toContain("https://growlogue.example/reset?token=<secret>");
    expect(body.html).toContain("token=&lt;secret&gt;");
  });

  it("fails without exposing the provider response body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("provider secret details", { status: 500 })
    );

    await expect(
      sendPasswordResetEmail({
        apiKey: "test-key",
        from: "Growlogue <growlogue@notify.aether42.com>",
        replyTo: "owner@example.com",
        to: "owner@example.com",
        url: "https://growlogue.example/reset",
        token: "secret-token",
        fetcher
      })
    ).rejects.toThrow("Password reset email delivery failed (500)");
  });
});
