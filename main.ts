// news-image-20261118 — round 2 entry builder.
//
// Reads the validated front-page image (entry.png) that sits next to this
// script, checks that it is a well-formed PNG within the competition limits,
// and copies it unchanged into the output directory.
//
// Usage:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory comes from MAKEFUN_OUTPUT_DIR and defaults to ./out.
// The output file is always named entry.png. Only Node.js built-in modules
// are used, and no network access is needed.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1048576;
const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;
const OUTPUT_NAME = "entry.png";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC-32 (IEEE 802.3, polynomial 0xedb88320), built from scratch so the
// program needs no external dependency. The table is generated once at
// startup by shifting each byte value through the polynomial.
const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

// Walk every chunk of the PNG, verifying each chunk's CRC-32 and that the
// IEND chunk exists and is the very last chunk. Returns the IHDR width and
// height so the caller can enforce the size limits.
function checkChunks(data: Buffer): { width: number; height: number } {
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let sawIhdr = false;
  let sawIdat = false;
  let chunkCount = 0;

  while (offset < data.length) {
    if (offset + 8 > data.length) {
      fail(`truncated chunk header at byte offset ${offset}`);
    }
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > data.length) {
      fail(`chunk ${type} at offset ${offset} claims ${length} bytes but the file ends early`);
    }
    const storedCrc = data.readUInt32BE(dataEnd);
    const actualCrc = crc32(data.subarray(offset + 4, dataEnd));
    if (storedCrc !== actualCrc) {
      fail(`chunk ${type} at offset ${offset} has a bad CRC (stored ${storedCrc}, computed ${actualCrc})`);
    }
    chunkCount += 1;

    if (type === "IHDR") {
      if (chunkCount !== 1) {
        fail("IHDR must be the first chunk");
      }
      if (length !== 13) {
        fail(`IHDR must be 13 bytes long, got ${length}`);
      }
      width = data.readUInt32BE(dataStart);
      height = data.readUInt32BE(dataStart + 4);
      sawIhdr = true;
    }

    if (type === "IDAT") {
      if (!sawIhdr) {
        fail("IDAT found before any IHDR chunk");
      }
      if (length === 0) {
        fail(`empty IDAT chunk at offset ${offset}`);
      }
      sawIdat = true;
    }

    if (type === "IEND") {
      if (length !== 0) {
        fail(`IEND must be empty, got ${length} bytes`);
      }
      if (!sawIdat) {
        fail("no IDAT chunk found; the PNG carries no image data");
      }
      if (dataEnd + 4 !== data.length) {
        fail("IEND must be the last chunk, but trailing bytes follow it");
      }
      if (!sawIhdr) {
        fail("IEND found before any IHDR chunk");
      }
      return { width, height };
    }

    offset = dataEnd + 4;
  }

  fail("no IEND chunk found; the PNG is truncated");
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(here, "entry.png");
  if (!existsSync(sourcePath)) {
    fail(`source image not found: ${sourcePath}`);
  }

  const size = statSync(sourcePath).size;
  if (size > MAX_BYTES) {
    fail(`entry.png is ${size} bytes, over the ${MAX_BYTES} byte limit`);
  }
  if (size < PNG_SIGNATURE.length + 25) {
    fail(`entry.png is only ${size} bytes, too small to be a valid PNG`);
  }

  const data = readFileSync(sourcePath);
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail("entry.png does not start with the PNG signature 89 50 4E 47 0D 0A 1A 0A");
  }

  const { width, height } = checkChunks(data);
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    fail(`entry.png is ${width}x${height}, over the ${MAX_WIDTH}x${MAX_HEIGHT} limit`);
  }
  if (width === 0 || height === 0) {
    fail(`entry.png has an invalid size of ${width}x${height}`);
  }

  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "./out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, OUTPUT_NAME);
  copyFileSync(sourcePath, outPath);
  console.log(`wrote ${outPath} (${width}x${height}, ${size} bytes)`);
}

main();
