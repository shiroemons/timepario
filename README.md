# TimePario

最大3地域の時刻を並べて比較できる、軽量な世界時計。

**[TimeParioを開く](https://timepario.shiroemons.workers.dev)**

## できること

- アナログ・デジタル時計で時刻を比較
- 時計カードに現在の略称（JST・PST・PDTなど）を表示
- 文字盤の色で深夜・朝・昼・夕方・夜を表示
- 基準の地域を選んで時差を確認
- ドラッグや矢印ボタンで並べ替え
- 「リンクをコピー」で地域と表示順を共有（OGP対応）
- 拡大表示・全画面表示に切り替え
- ブラウザーの設定に合わせて日本語・英語を自動選択
- ライト・ダーク・システム連動のテーマ切り替え
- PWAとしてインストール・オフライン利用

## 使い方

- 「時計を追加」で地域を検索。地域名・IANA名・略称に対応
- 時計の地域名を押すと変更、×で削除
- 「時差の基準」で比較元を選択。再読み込みで解除
- 拡大・全画面表示は `Esc` で終了
- テーマアイコンで配色を選択。初期値はシステム連動、選択は端末ごとに保存
- PWAはブラウザーのインストール機能を利用。初回はオンラインで読み込みが必要

## URLで地域を指定

- `/`：端末のタイムゾーン
- `/jst,pt,utc`：日本・米国太平洋・UTCの3時計
- `/jst,Asia~Kathmandu`：IANA名の `/` は `~` に置換
- 不明な地域や、重複を除いて4地域以上の指定はエラー

| 短縮名 | 地域 | 夏時間 |
| --- | --- | --- |
| `jst` | 日本 | なし |
| `pst` | 太平洋標準時（UTC−08:00固定） | なし |
| `pt` | ロサンゼルス | 自動対応 |
| `utc` | 協定世界時 | なし |
| `et` | ニューヨーク | 自動対応 |

## 開発

- 必要環境：Node.js 24 LTS / pnpm 11.19.0
- 構成：TypeScript / Hono / Cloudflare Workers

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- [localhost:8787](http://localhost:8787) を開く
- ソース変更は自動ビルド。ブラウザーを再読み込みして確認

| コマンド | 内容 |
| --- | --- |
| `pnpm typecheck` | 型チェック |
| `pnpm lint` | コード検査 |
| `pnpm test` | ユニットテスト |
| `pnpm test:e2e` | Chromium / Firefox / WebKitで検証 |
| `pnpm build` | 本番ビルド（公開なし） |
| `pnpm size` | JS・CSSの容量チェック |

E2Eテストの初回準備：

```sh
pnpm exec playwright install chromium firefox webkit
```

## デプロイ

- 公開先：Cloudflare Workers / Worker名：`timepario`
- DB・KVは不要

```sh
pnpm exec wrangler login
pnpm run deploy
```

- CIでは `CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID` を環境変数に設定
- 認証情報はリポジトリに保存しない

## 補足・詳細

- 時刻は端末設定に依存。標準時との同期は行いません
- 夏時間はブラウザーのタイムゾーンデータに依存
- 文字盤の時間帯は時刻で判定。実際の日の出・日の入りとは異なります
- OSのスクリーンセーバー登録・スリープ防止には非対応
- [検証結果・容量](docs/verification.md)
- [時刻とURLの設計](docs/decisions/0001-time-and-url.md)
- [言語・並べ替え](docs/decisions/0002-language-and-reordering.md) / [全画面表示](docs/decisions/0003-fullscreen-clocks.md) / [PWA](docs/decisions/0004-pwa.md)
- [依存関係](docs/dependencies.md) / [ライセンス](docs/licenses/README.md)
- [テーマの設計](docs/decisions/0005-theme.md)
