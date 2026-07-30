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

## Phase 5 週間共有カード

- R2: `growlogue-assets`（Standard、非公開）
- Web bindings: `SHARE_CARDS`、`BROWSER`
- 画像: Browser Run Quick Actionで生成する1200×630px PNG
- 公開面: `/share/:token`と`/share/:token/image`

公開前にR2とBrowser Runの最新料金・無料枠、Cloudflareアカウント、既存バケットを
読み取り確認する。`growlogue-assets`を作成した後、R2とBrowser Run bindingsを
含むWeb Workerだけを公開する。R2の`r2.dev`公開は有効化しない。

公開後は、共有カード生成、PNGのContent-Type、有効URLの200、失効後のページと
画像の404を確認する。失敗時はWeb Workerを直前versionへ戻す。新規R2オブジェクトは
非公開のため、Workerを戻した時点で外部からは参照できない。

## Phase 5 月間レポート

Migrationは不要。既存D1を本人認証後に都度集計する。OpenNext Workerの容量を
確保するため、D1集計は非公開の`growlogue-reports` Workerへ分離する。

公開順序は次のとおり。

1. `pnpm verify`を実行する。
2. `pnpm --filter @growlogue/reports-worker build`とWebのOpenNext dry runを実行する。
3. `pnpm --filter @growlogue/reports-worker deploy`で内部Workerを先に公開する。
4. `pnpm --filter @growlogue/web deploy`でService Bindingを持つWeb Workerを公開する。
5. Reports Workerに`workers.dev` URLとpreview URLがないことを確認する。

Service Bindingは`REPORTS -> growlogue-reports`とする。Web Workerだけが公開APIを持ち、
Reports WorkerへCookieや認証Secretを持たせない。ローカルでWorkers runtimeを
確認する場合は、`pnpm preview:workers`でOpenNext build後にWeb、Reports、AI、
Life UnlocksのconfigをWranglerへ渡す。

公開後に次を確認する。

1. `/reports/monthly`で現在月が表示される。
2. 前月・次月でURLの`month=YYYY-MM`と表示月が一致する。
3. `/api/v1/reports/monthly?month=YYYY-MM`が未認証では401になる。
4. 達成、XP、Daily Clear、Perfect、能力別XPが週間レポートと矛盾しない。
5. 390px幅でカレンダーと下部ナビゲーションに横スクロールが出ない。
6. Web Workerの圧縮後サイズが3 MiB未満であり、今後の月間集計追加がWeb bundleを
   増やさない境界になっている。
7. Reports Workerを公開URLから直接呼べず、Service Binding経由だけで応答する。

## 検証

- 許可メールだけが初回登録できる。
- 基本3件とボーナス2件が生成される。
- 二重送信でもXPが一度だけ増える。
- 再読込後もXP、能力値、Daily Clear、Perfect、連続記録が残る。
- PC幅と390px幅でホーム、習慣、能力、設定が操作できる。

## ロールバック

- 問題時は直前のWorker versionへ戻す。
- Reports分離の問題時はWeb Workerを分離前versionへ先に戻す。内部Reports Workerは
  公開面を持たないため、即時削除せず原因確認と再公開に備えて残す。
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
`0005_life_unlocks.sql`だけが含まれることを確認する。migration適用後、
`growlogue-life-unlocks`を先に公開し、続いてService Bindingを持つWeb Workerを公開して、
次を検証する。

1. 未認証の`GET /api/v1/wishes`が401を返す。
2. 本人がWish、Quest、AND条件を登録できる。
3. 自動指標と手動指標がCondition Engineで評価される。
4. 同じ`Idempotency-Key`でUnlockを再送しても`WishEvent`が増えない。
5. Reward完了後にWishが`COMPLETED`となり、再読込後も保持される。
6. iPhoneではSafariの共有メニューからホーム画面へ追加し、ホーム画面のWebアプリ内で通知を有効化できる案内が表示される。
7. `growlogue-life-unlocks`にworkers.dev URLとpreview URLがなく、Web API経由だけで利用できる。

問題時はWorkerを直前versionへ戻す。新テーブルは既存のHabit、Mission、XP、Streak、
Pushデータから独立しているため、データを削除せず修正版migrationで前進する。
