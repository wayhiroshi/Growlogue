# アーキテクチャ判断

## 境界

- `apps/web`: Next.js UI、Better Auth、JSON API
- `apps/scheduler`: 15分Cron、通知判定、Web Push配信、重複送信防止
- `apps/reports`: 本人限定レポートのD1集計を行う非公開Worker
- `packages/domain`: UIやDBに依存しないゲームルール
- `packages/life-unlocks`: DBやHabitに依存しないCondition Engineと進捗計算
- `packages/reports`: UIやDBに依存しないレポート集計ルールとAPI型
- `packages/db`: Prismaモデル、D1 migration、原子的な書き込み
- `packages/content`: 世界観、カテゴリ、習慣、執事文面

## Phase 3 notification flow

1. 設定画面の明示操作でService Workerを登録し、ブラウザのPush Subscriptionを作成する。
2. `/api/v1/push/subscriptions`が本人の購読情報をD1へ保存する。
3. `growlogue-scheduler`が15分ごとに利用者タイムゾーン、夜間停止、今日の進捗、休息モードを評価する。
4. `NotificationDelivery`を先にclaimし、同一端末・同一日・同一triggerの二重送信を防ぐ。
5. VAPID秘密鍵で暗号化したpayloadをブラウザのPush endpointへ直接送る。
6. 404/410になった購読は無効化し、本文や購読endpointはログへ出さない。

## D1とPrisma

通常の参照にはPrisma Clientを使う。D1用Prismaアダプターはトランザクションを保証しないため、XPを伴う達成・取り消しはD1 Bindingの`batch()`で実行する。

Life Unlocksの6テーブルは、無料枠Workerの圧縮後3 MiB制限を守るためPrisma Clientへ
生成せず、型付きの行定義とprepared statementでD1 Bindingへアクセスする。テーブルの
正式なスキーマは`0005_life_unlocks.sql`とし、所有者条件を各SQLに必須化する。

XPは不変の台帳へ記録する。取り消しは元の記録を削除せず、負の相殺記録を追加する。

「もう一巡」は既存の`ActivityEvent`へ`ENCORE`として保存する。初回達成とは
別イベントにしてDaily ClearとPerfectの集計から除外し、追加XPは
`XpLedger.reason = MISSION_ENCORE`で台帳化する。

## Life Unlocks境界

Condition EngineはDBを参照せず、`MetricFact[]`を入力として条件とQuestを評価する。Web層のFact Providerが、総XP、カテゴリXP、連続日数、達成回数、手入力値を同じ形式へ変換する。

手入力値は`ConditionFact`へ時系列で追記し、Questの`currentValue`を直接上書きしない。WishのUnlockedとCompletedは`WishEvent`台帳を先にclaimし、D1 `batch()`でWish・Rewardへ反映する。

## API

APIは`/api/v1`へ統一し、認証済みユーザーのIDを必ず所有者条件へ含める。状態遷移を伴う書き込みは入力検証とIdempotency-Keyを必須とする。

## Reports Worker境界

OpenNextのWeb Workerを無料枠の圧縮後3 MiB制限内に保つため、月間レポートのD1集計を
`growlogue-reports`へ分離する。公開APIは従来どおり
`GET /api/v1/reports/monthly`だけとし、Web WorkerでBetter Authの本人認証と入力検証を
終えてからService Binding `REPORTS`で内部転送する。

Reports Workerは`workers_dev: false`、`preview_urls: false`とし、公開routeを持たない。
Web WorkerはCookie、Authorization、接続元IPを転送せず、認証済みUser IDだけを
`X-Growlogue-User-Id`へ設定する。Reports Workerも月形式とUser IDを再検証し、
すべてのD1 SQLへUser ID条件を含める。両Workerは同じ`@growlogue/reports`の決定的な
集計ルールを使い、サービス障害時はWeb APIが503を返してゲーム本体を継続させる。
