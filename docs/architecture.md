# アーキテクチャ判断

## 境界

- `apps/web`: Next.js UI、Better Auth、JSON API
- `apps/scheduler`: 将来のWeb Pushと定期処理
- `packages/domain`: UIやDBに依存しないゲームルール
- `packages/db`: Prismaモデル、D1 migration、原子的な書き込み
- `packages/content`: 世界観、カテゴリ、習慣、執事文面

## D1とPrisma

通常の参照にはPrisma Clientを使う。D1用Prismaアダプターはトランザクションを保証しないため、XPを伴う達成・取り消しはD1 Bindingの`batch()`で実行する。

XPは不変の台帳へ記録する。取り消しは元の記録を削除せず、負の相殺記録を追加する。

## API

APIは`/api/v1`へ統一し、認証済みユーザーのIDを必ず所有者条件へ含める。書き込みは入力検証とIdempotency-Keyを必須とする。
