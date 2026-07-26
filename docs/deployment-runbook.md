# 本人用本番の公開手順

## 対象

- Cloudflare account: 公開直前の`wrangler whoami`で確認する
- Worker: `growlogue`
- D1: `growlogue-db`
- 公開先: `workers.dev`
- R2: Phase 4の共有カード実装時に`growlogue-assets`を作成する

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

R2はPhase 1〜3では使用しない。共有カード画像の保存が必要になるPhase 4で、利用料金と権限を再確認してから追加する。

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
