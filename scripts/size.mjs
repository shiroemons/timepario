import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

for (const [name, limit] of [
  ["app.js", 20 * 1024],
  ["app.css", 10 * 1024],
]) {
  const contents = await readFile(`dist/client/assets/${name}`);
  const gzip = gzipSync(contents).byteLength;
  console.log(
    `${name}: ${contents.byteLength} bytes raw, ${gzip} bytes gzip (budget ${limit} bytes)`,
  );
  if (gzip > limit) process.exitCode = 1;
}
