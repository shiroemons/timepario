# 日本語のタイムゾーン都市名

`src/shared/zone-names-ja.ts` は Unicode CLDR の日本語 `exemplarCity` 419 件と、同じ版の BCP 47 タイムゾーン別名に対応する 138 件から生成した都市名データです。別名でも都市名が定義されている場合は、その名前を優先しています。翻訳や別名の対応を独自に推測したものは含めていません。

出典は `unicode-org/cldr-json` のコミット `1aaabe99aa652d6f22ea488cf25baea46aa69b42` に固定しています。

- [日本語の都市名](https://github.com/unicode-org/cldr-json/blob/1aaabe99aa652d6f22ea488cf25baea46aa69b42/cldr-json/cldr-dates-full/main/ja/timeZoneNames.json)
- [BCP 47 タイムゾーンの別名](https://github.com/unicode-org/cldr-json/blob/1aaabe99aa652d6f22ea488cf25baea46aa69b42/cldr-json/cldr-bcp47/bcp47/timezone.json)
- [原本のライセンス](https://github.com/unicode-org/cldr-json/blob/1aaabe99aa652d6f22ea488cf25baea46aa69b42/LICENSE)

Unicode License V3 の全文を [unicode.txt](./unicode.txt) に収録しています。

更新時は同一コミットの両 JSON を取得し、都市名ツリーの `exemplarCity` を IANA 識別子のキーに平坦化します。BCP 47 の各 `_alias` グループ内に既存の都市名がある場合、その名前を未登録の別名へ追加します。既存の都市名は上書きせず、タイムゾーン識別子の順で整列してください。
