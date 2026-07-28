# 本人用本番の公開手順

## 対象

- Cloudflare account: 公開直前の`wrangler whoami`で確認する
- Worker: `growlogue`
- D1: `growlogue-db`
- 公開先: `workers.dev`
- R2: Phase 5の共有カード実装時に`growlogue-assets`を作成する

## 公開前ゲート

1. CloudflareのログインメールとAccount IDを読み取り確認する。
2. 同名のWorkerとD1が存在しないか確認する。
3. `OWNER_EMAIL`、公開URL、Secretの保存先を確認する。
4. `pnpm verify`とOpenNext buildを再実行する。

## 作成と公開

1. D1を作成し、返されたIDをWebとschedulerの`wrangler.jsonc`へ設定する。
2. `OWNER_EMAIL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`をWorkers Secretsへ登録する。
3. remote D1 migrationを適用する。
4. OpenNext Workerを公開する。
5. 公開URLを`BETTER_AUTH_URL`へ設定し、必要なら再公開する。

R2はPhase 1〜4では使用しない。共有カード画像の保存が必要になるPhase 5で、利用料金と権限を再確認してから追加する。

## 検証

- 許可メールだけが初回登録できる。
- 基本3件とボーナス2件が生成される。
- 二重送信でもXPが一度だけ増える。
- 再読込後もXP、能力値、Daily Clear、Perfect、連続記録が残る。
- PC幅と390px幅でホーム、習慣、能力、設定が操作できる。

## ロールバック

- 問題時は直前のWorker versionへ戻す。
- D1のXP台帳は削除せず、修正migrationまたは相殺イベントで整合させる。
- 新規公開を停止する場合はWorkerを削除せず、先にrouteまたはworkers.dev公開を無効化する。

## Phase 3 Web Push

- Scheduler: `growlogue-scheduler`
- Cron: 15分間隔（UTC基準で実行し、通知判定は利用者タイムゾーンで行う）
- Secret: `VAPID_PRIVATE_KEY`
- 非秘密設定: `VAPID_PUBLIC_KEY`、`VAPID_SUBJECT`

公開前に、`0002_phase3_notifications.sql`以降をremote D1へ適用する。Schedulerは`workers_dev: false`、`preview_urls: false`を維持し、`pnpm --filter @growlogue/scheduler deploy`で公開する。最初の実端末購読後、手動scheduled testで1件を送り、`NotificationDelivery`が`SENT`になったことと、同じtriggerの再実行で件数が増えないことを確認する。

## Phase 4 Life Unlocks

- Migration: `0005_life_unlocks.sql`
- 追加テーブル: `Wish`、`Quest`、`QuestCondition`、`Reward`、`ConditionFact`、`WishEvent`
- 外部リソース追加: なし
- Scheduler変更: なし

公開前にD1 Time Travelの復元可能時点を確認し、remote migrationの未適用一覧に
`0005_life_unlocks.sql`だけが含まれることを確認する。migration適用後にWeb Workerを公開し、
次を検証する。

1. 未認証の`GET /api/v1/wishes`が401を返す。
2. 本人がWish、Quest、AND条件を登録できる。
3. 自動指標と手動指標がCondition Engineで評価される。
4. 同じ`Idempotency-Key`でUnlockを再送しても`WishEvent`が増えない。
5. Reward完了後にWishが`COMPLETED`となり、再読込後も保持される。
6. iPhoneではSafariの共有メニューからホーム画面へ追加し、ホーム画面のWebアプリ内で通知を有効化できる案内が表示される。

問題時はWorkerを直前versionへ戻す。新テーブルは既存のHabit、Mission、XP、Streak、
Pushデータから独立しているため、データを削除せず修正版migrationで前進する。
