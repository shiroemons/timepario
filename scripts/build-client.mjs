import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

export const browserBuildOptions = {
  entryPoints: [
    { in: "src/client/index.ts", out: "assets/app" },
    { in: "src/client/theme.ts", out: "assets/theme" },
    { in: "src/client/styles.css", out: "assets/app" },
  ],
  outdir: "dist/client",
  bundle: true,
  minify: true,
  charset: "utf8",
  format: "esm",
  target: ["es2022"],
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  plugins: [
    {
      name: "pwa-assets",
      setup(builder) {
        builder.onEnd(async (result) => {
          if (!result.errors.length) await buildPwaAssets();
        });
      },
    },
  ],
};

async function filesWithin(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesWithin(path) : [path];
    }),
  );
  return files.flat().sort();
}

async function buildPwaAssets() {
  const sourceFiles = [
    ...(await filesWithin("src")),
    ...(await filesWithin("public")),
    ...(await filesWithin("scripts")),
  ].filter((path) => path !== "src/server/pwa-version.ts");
  const browserFiles = (await filesWithin("dist/client/assets")).filter((path) =>
    /\.(?:js|css)$/.test(path),
  );
  const versionHash = createHash("sha256");
  for (const path of [...sourceFiles, ...browserFiles].sort())
    versionHash.update(path).update(await readFile(path));
  const version = versionHash.digest("hex").slice(0, 20);
  const versionSource = `// build-client.mjs が内容変更時だけ更新する。初回の型検査・テスト用にも有効な値を保持する。\nexport const PWA_VERSION = "${version}";\n`;
  if ((await readFile("src/server/pwa-version.ts", "utf8")) !== versionSource)
    await writeFile("src/server/pwa-version.ts", versionSource);
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
  for (const icon of manifest.icons) icon.src += `?v=${version}`;
  await writeFile("dist/client/manifest.webmanifest", `${JSON.stringify(manifest)}\n`);
  const assetPaths = [
    ...browserFiles,
    "dist/client/favicon.svg",
    "dist/client/manifest.webmanifest",
    ...(await filesWithin("dist/client/icons")),
  ];
  const precache = await Promise.all(
    assetPaths.map(async (path) => ({
      url: `${path.slice("dist/client".length)}?v=${version}`,
      digest: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
  precache.push({ url: `/offline?v=${version}`, digest: "" });
  await build({
    entryPoints: ["src/service-worker.ts"],
    outfile: "dist/client/sw.js",
    bundle: true,
    minify: true,
    charset: "utf8",
    target: "es2022",
    format: "iife",
    define: { __PWA_VERSION__: JSON.stringify(version), __PRECACHE__: JSON.stringify(precache) },
    logLevel: "silent",
  });
}

async function removeAssetFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await removeAssetFiles(path);
      else await rm(path, { force: true });
    }),
  );
}

export async function prepareAssets() {
  await mkdir("dist/client", { recursive: true });
  // Wrangler の監視を維持するため、ディレクトリを残して古いファイルだけ削除する。
  await removeAssetFiles("dist/client");
  await mkdir("dist/client/assets", { recursive: true });
  await cp("public", "dist/client", { recursive: true });
}

export async function buildClient() {
  await prepareAssets();
  await build(browserBuildOptions);
}

if (process.argv[1]?.endsWith("build-client.mjs")) {
  await buildClient();
}
