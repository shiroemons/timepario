import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { cp } from "node:fs/promises";
import { context } from "esbuild";
import { browserBuildOptions, prepareAssets } from "./build-client.mjs";

await prepareAssets();
const browser = await context({ ...browserBuildOptions, minify: false, sourcemap: true });
await browser.rebuild();
const worker = spawn(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", "dev", "--ip", "127.0.0.1", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
let rebuildTimer;
let copyPublic = false;
function queueBuild(includePublic = false) {
  copyPublic ||= includePublic;
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    try {
      if (copyPublic) {
        copyPublic = false;
        await cp("public", "dist/client", { recursive: true });
      }
      await browser.rebuild();
    } catch (error) {
      console.error("Could not rebuild browser and PWA assets:", error);
      void shutdown(1);
    }
  }, 100);
}
const assets = watch("public", { recursive: true }, () => queueBuild(true));
const sources = watch("src", { recursive: true }, (_event, filename) => {
  // 自動生成された版情報の書き込みで再ビルドが循環しないようにする。
  if (filename !== "server/pwa-version.ts") queueBuild();
});

let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  assets.close();
  sources.close();
  clearTimeout(rebuildTimer);
  if (worker.pid && worker.exitCode === null && worker.signalCode === null) {
    if (process.platform === "win32") worker.kill("SIGTERM");
    else process.kill(-worker.pid, "SIGTERM");
  }
  await browser.dispose();
  process.exitCode = code;
}
process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));
worker.once("error", (error) => {
  console.error("Could not start Wrangler:", error);
  void shutdown(1);
});
worker.once("exit", (code) => void shutdown(code ?? 1));
