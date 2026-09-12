# 依存関係の確認

2026-09-12 に npm 公式レジストリの最新安定版 (`latest`) を確認。Node.js 24.21.0 / pnpm 11.19.0 で導入・検証する。実行依存は Hono のみで、他は開発・ビルド・検証用。以下のサイズは npm パッケージ展開サイズであり、ブラウザー転送量ではない。

| Package | Version | License | 展開サイズ (bytes) | Node 条件 |
| --- | --- | --- | ---: | --- |
| hono | 4.13.7 | MIT | 1,391,192 | >=16.9.0 |
| typescript | 7.0.2 | Apache-2.0 | 2,497,498 | >=16.20.0 |
| esbuild | 0.28.2 | MIT | 147,361 | >=18 |
| wrangler | 4.131.1 | MIT OR Apache-2.0 | 15,270,864 | >=22.0.0 |
| vitest | 5.0.0 | MIT | 2,735,325 | ^22.12.0 / ^24.0.0 / >=26.0.0 |
| @playwright/test | 1.63.0 | Apache-2.0 | 28,544 | >=20 |
| @types/node | 22.20.2 | MIT | 2,438,701 | 指定なし |
| @biomejs/biome | 2.5.13 | MIT OR Apache-2.0 | 769,596 | >=14.21.3 |

レジストリの `time.modified` は全て 2026 年8〜9月。これはパッケージメタデータの最終更新日時であり、各バージョンの公開日時とは区別する。Biome を lint / formatting の一つのツールとして選び、役割の重複を避ける。Wrangler が Worker をビルドし、esbuild はブラウザー用 JavaScript と CSS のみをビルドする。

Wrangler の安定版 4.131.1 は内部で `miniflare@5.20260911.0-alpha` を依存として指定している。アプリからこのプレリリースを直接追加したものではない。pnpm は公開後の待機期間の例外をこの2パッケージに限定して `minimumReleaseAgeExclude` へ記録した。インストール時に実行を許可するビルド処理も esbuild / workerd / sharp に限定している。

確認コマンド: `npm view <package> version license engines dist.unpackedSize time.modified --json`。

## 日本語の都市名データ

Unicode CLDR JSONのコミット `1aaabe99aa652d6f22ea488cf25baea46aa69b42` から、日本語の `exemplarCity` とBCP 47のタイムゾーン別名を抽出して同梱。翻訳ライブラリや実行時通信は追加していない。

- [日本語タイムゾーン名の原典](https://github.com/unicode-org/cldr-json/blob/1aaabe99aa652d6f22ea488cf25baea46aa69b42/cldr-json/cldr-dates-full/main/ja/timeZoneNames.json)
- [タイムゾーンの別名の原典](https://github.com/unicode-org/cldr-json/blob/1aaabe99aa652d6f22ea488cf25baea46aa69b42/cldr-json/cldr-bcp47/bcp47/timezone.json)
- [同梱したUnicode License V3](licenses/unicode.txt)

抽出データは `src/shared/zone-names-ja.ts`。アプリ固有のUTC・JST・固定PST・PT・ETは既存の辞書を優先する。

公式資料:

- https://hono.dev/docs/getting-started/cloudflare-workers
- https://hono.dev/docs/guides/jsx
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://esbuild.github.io/api/
- https://vitest.dev/guide/
- https://playwright.dev/docs/intro
- https://biomejs.dev/guides/getting-started/
