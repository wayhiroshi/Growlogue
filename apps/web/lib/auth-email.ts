interface PasswordResetEmailInput {
  apiKey: string;
  from: string;
  replyTo: string;
  to: string;
  url: string;
  token: string;
  fetcher?: typeof fetch;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function tokenDigest(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function sendPasswordResetEmail({
  apiKey,
  from,
  replyTo,
  to,
  url,
  token,
  fetcher = fetch
}: PasswordResetEmailInput): Promise<void> {
  const safeUrl = escapeHtml(url);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `password-reset/${await tokenDigest(token)}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject: "Growlogue パスワード再設定",
      text: [
        "Growlogueのパスワード再設定がリクエストされました。",
        "",
        "次のリンクから1時間以内に新しいパスワードを設定してください。",
        url,
        "",
        "この操作に心当たりがない場合は、このメールを破棄してください。"
      ].join("\n"),
      html: `
        <div style="font-family: sans-serif; line-height: 1.7; color: #1d2922;">
          <h1 style="font-size: 22px;">Growlogue パスワード再設定</h1>
          <p>パスワード再設定がリクエストされました。</p>
          <p>次のボタンから1時間以内に新しいパスワードを設定してください。</p>
          <p style="margin: 28px 0;">
            <a href="${safeUrl}" style="display: inline-block; border-radius: 999px; background: #173f35; color: white; padding: 12px 22px; text-decoration: none; font-weight: 700;">
              新しいパスワードを設定する
            </a>
          </p>
          <p style="font-size: 13px; color: #68756d;">この操作に心当たりがない場合は、このメールを破棄してください。</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    throw new Error(`Password reset email delivery failed (${response.status})`);
  }
}
