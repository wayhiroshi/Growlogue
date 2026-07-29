# Phase 6 AI伴走 日次レビュー仕様

## 目的

最初の縦切りは、本人が明示的に依頼した時だけLucienがその日の集計を短く
振り返る機能とする。ゲーム本体からAIを切り離し、AI Gateway、OpenAI API、
Moderationのいずれが停止しても固定文で同じ操作を完走できる。

## 境界

- 公開Web APIは`POST /api/v1/coach/daily-review`とする。
- Webは認証済み本人のD1データから集計を作り、非公開`growlogue-ai` Workerを
  Service Bindingで呼び出す。
- AI Workerは`workers.dev`とPreview URLを持たず、Web Workerからだけ呼べる。
- 自動実行はしない。利用者が「今日を見る」を押した場合だけ外部APIを呼ぶ。
- `AI_ENABLED`の既定値は`false`とし、無効時もHTTP 200で固定レビューを返す。

## AI Workerへ渡すデータ

許可する値は次の集計だけとする。

- ゲーム内日付
- 日モード
- Core完了数、全完了数、全ミッション数
- 当日獲得XP
- 現在の連続日数
- Daily Clear、Perfectの真偽

外部のOpenAI Responses APIへは、ここからゲーム内日付と日モードも除外し、
完了数、XP、連続日数、Daily Clear、Perfectだけを送る。日モードは固定文を
安全に選ぶために非公開Worker内だけで使用する。

次の値は禁止する。

- Wish、Quest、Reward、Condition Fact
- 習慣名、ミッション名
- メモ、自由入力本文
- メールアドレス、DB上の利用者ID
- 収入、体重、資産、健康状態などのFact

OpenAIへ送る`safety_identifier`は、利用者IDを`AI_SAFETY_SECRET`で
HMAC-SHA-256化した64文字の値とする。Responses APIでは`store: false`を指定する。

## 出力と安全性

Structured Outputsで次のJSONを要求する。

```json
{
  "summary": "120文字以内",
  "nextAction": "80文字以内"
}
```

次の順に検査し、一つでも失敗した場合は固定文へ戻る。

1. Responses APIが正常完了している
2. JSONを解析でき、必須フィールドと最大文字数を満たす
3. 罪悪感や罰を与える禁止表現を含まない
4. `omni-moderation-latest`が`flagged: false`を返す

APIキー、トークン、入力本文、生成本文はログへ出さない。ログへ残すのは
フォールバック理由とエラー種別だけとする。

## 環境変数

| 変数 | 種別 | 用途 |
|---|---|---|
| `AI_ENABLED` | 通常変数 | `true`の時だけ外部AIを呼ぶ。既定は`false` |
| `AI_MODEL` | 通常変数 | 既定`gpt-5.6-luna` |
| `AI_GATEWAY_URL` | Secret | `{account}/{gateway}/openai`までのGateway URL |
| `AI_GATEWAY_TOKEN` | Secret | 認証済みAI Gateway用Cloudflare Token |
| `OPENAI_API_KEY` | Secret | このアプリ専用・推論専用OpenAI Project Key |
| `AI_SAFETY_SECRET` | Secret | safety identifier生成専用のランダム値 |

本番有効化前に、Cloudflare AI Gatewayの対象、ログ設定、Spend Limit、OpenAI
Projectの対象と予算を読み取り確認する。Secret投入、課金有効化、
`AI_ENABLED=true`への変更は別の明示承認後に行う。

## API受入条件

- 未認証では401を返し、AI Workerを呼ばない。
- クライアントから日次集計や利用者IDを指定できない。
- AI Workerの公開URLからは到達できない。
- AI無効、設定不足、タイムアウト、429/5xx、拒否、不正JSON、文字数超過、
  禁止表現、Moderation失敗のすべてで固定レビューをHTTP 200で返す。
- 固定レビューは日モード、未達、Daily Clear、Perfectで決定的に変わる。
- AIを使わなくてもミッション達成、XP、通知、Life Unlocksは影響を受けない。
- モバイル幅で、ボタン、待機表示、結果、再試行が横スクロールなく操作できる。

## 現行API判断

2026-07-30時点の公式仕様に合わせ、Responses APIの`text.format`による
JSON Schema、`safety_identifier`、`store: false`を使用する。既定モデルは
コスト重視の`gpt-5.6-luna`とし、モデル名は環境変数で差し替え可能にする。

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Cloudflare AI Gateway OpenAI provider](https://developers.cloudflare.com/ai-gateway/usage/providers/openai/)
- [Cloudflare Workers Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)

## 次の縦切り

日次レビューの本人利用、安全性、コストを確認した後に、同じ境界で翌日提案、
通知文の言い換えへ進む。Wish提案とQuest生成はさらに後とし、Condition Factは
引き続きAIへ送らない。
