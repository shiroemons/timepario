import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

// 既存 favicon.svg と同じ時計を、追加の画像ライブラリーなしで PNG に描画する。
function chunk(type, data) {
  const name = Buffer.from(type);
  const contents = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, contents, checksum]);
}

function distance(x, y, x1, y1, x2, y2) {
  const amount = Math.max(
    0,
    Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)),
  );
  return Math.hypot(x - x1 - amount * (x2 - x1), y - y1 - amount * (y2 - y1));
}

function icon(size, maskable) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const color = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const scale = maskable ? 0.82 : 1;
          const x = (((column + (dx + 0.5) / 2) / size) * 64 - 32) / scale + 32;
          const y = (((row + (dy + 0.5) / 2) / size) * 64 - 32) / scale + 32;
          let sample = [20, 29, 33];
          if (Math.abs(Math.hypot(x - 32, y - 32) - 22) < 1.5) sample = [248, 246, 239];
          if (Math.min(distance(x, y, 32, 17, 32, 32), distance(x, y, 32, 32, 42, 38)) < 2)
            sample = [204, 226, 148];
          for (let index = 0; index < 3; index++) color[index] += sample[index] / 4;
        }
      const offset = row * (size * 4 + 1) + 1 + column * 4;
      for (let index = 0; index < 3; index++) pixels[offset + index] = Math.round(color[index]);
      pixels[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir("public/icons", { recursive: true });
for (const [name, size, maskable] of [
  ["icon-192", 192, false],
  ["icon-512", 512, false],
  ["maskable-512", 512, true],
  ["apple-touch-icon", 180, false],
]) {
  await writeFile(`public/icons/${name}.png`, icon(size, maskable));
}
