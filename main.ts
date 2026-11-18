// makefun-news-image-20261118 — entry program.
//
// What this program does, in one sentence: it reads the front-page image
// `entry.png` that ships in this repository, checks that it is a whole,
// well-formed PNG inside the competition limits, and copies it byte for
// byte to `<output dir>/entry.png`.
//
// The output directory comes from the MAKEFUN_OUTPUT_DIR environment
// variable when it is set (that is how the entry is run locally), and
// defaults to `/output`, which is where the make.fun grader expects the
// image. Nothing here touches the network, and nothing is random: the
// same input file always produces the same output bytes, so two runs
// of this program write identical files.
//
// Only the Node.js standard library is used: `node:fs` for reading and
// writing files, `node:path` for joining paths, and `node:zlib` for the
// CRC-32 checks that prove every PNG chunk is intact.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { crc32 } from "node:zlib";

// The competition caps: at most 1 MiB (1048576 bytes) and at most
// 1024 by 1024 pixels. Anything bigger is refused, never truncated,
// because silently shrinking the image would change what the judge sees.
const MAX_BYTES = 1024 * 1024;
const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;

// The eight-byte PNG signature every PNG file must start with.
// Checking it first keeps a misnamed JPEG (or any other file) from
// ever being passed off as this entry's PNG.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Where the source image lives: next to this program, in the root of
// the repository. `import.meta.url` keeps the lookup correct no matter
// which working directory the program is started from.
const SOURCE_PATH = resolve(dirname(new URL(import.meta.url).pathname), "entry.png");

// Where the validated copy goes. The grader runs with a writable
// `/output`; local runs set MAKEFUN_OUTPUT_DIR to a scratch folder.
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const OUTPUT_PATH = join(OUTPUT_DIR, "entry.png");

// Fail loudly with a clear message instead of writing a bad file.
function fail(message: string): never {
  throw new Error(`makefun-news-image-20261118: ${message}`);
}

// Read one unsigned 32-bit big-endian integer out of a buffer.
function readU32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

// Walk every chunk of the PNG and check its CRC-32. A PNG is a chain
// of chunks — length, four-letter type, payload, CRC — and the CRC
// covers the type bytes plus the payload. Any chunk whose stored CRC
// does not match the computed one means the file is damaged or was
// cut short, so the run stops before anything is copied.
//
// The walk also collects the width and height from the IHDR chunk
// (the first chunk, whose 13-byte payload starts with width then
// height), and insists on seeing exactly one IHDR first and one IEND
// chunk last, so a file that is only a header, or one with trailing
// junk after IEND, is refused as well.
function validatePng(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < PNG_SIGNATURE.length) {
    fail(`entry.png is only ${bytes.length} bytes, shorter than the PNG signature`);
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    fail("entry.png does not start with the PNG signature");
  }
  if (bytes.length > MAX_BYTES) {
    fail(`entry.png is ${bytes.length} bytes, over the ${MAX_BYTES} byte limit`);
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let sawIhdr = false;
  let sawIend = false;
  let chunkIndex = 0;

  while (offset < bytes.length) {
    // Every chunk needs at least 12 bytes: 4 for length, 4 for type,
    // 4 for the CRC (a zero-length payload still has those 12).
    if (offset + 12 > bytes.length) {
      fail(`PNG ends mid-chunk at byte ${offset}`);
    }
    const length = readU32(bytes, offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcStart = dataEnd;
    if (dataEnd + 4 > bytes.length) {
      fail(`chunk ${type} at byte ${offset} claims ${length} bytes but the file ends first`);
    }

    // CRC-32 over the chunk type and its payload, compared with the
    // four CRC bytes stored right after the payload.
    const expected = readU32(bytes, crcStart);
    const actual = crc32(bytes.subarray(offset + 4, dataEnd));
    if (actual !== expected) {
      fail(`chunk ${type} at byte ${offset} has a bad CRC (stored ${expected}, computed ${actual})`);
    }

    if (chunkIndex === 0) {
      // The first chunk must be IHDR, and it must be exactly 13 bytes.
      if (type !== "IHDR" || length !== 13) {
        fail(`first chunk is ${type} (${length} bytes), expected a 13-byte IHDR`);
      }
      sawIhdr = true;
      width = readU32(bytes, dataStart);
      height = readU32(bytes, dataStart + 4);
      if (width === 0 || height === 0) {
        fail(`IHDR reports zero size (${width}x${height})`);
      }
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        fail(`image is ${width}x${height}, over the ${MAX_WIDTH}x${MAX_HEIGHT} limit`);
      }
    }
    if (type === "IEND") {
      if (length !== 0) {
        fail("IEND chunk must be empty");
      }
      sawIend = true;
      // IEND is the last chunk: anything after it is trailing junk.
      if (crcStart + 4 !== bytes.length) {
        fail(`file has ${bytes.length - (crcStart + 4)} trailing bytes after IEND`);
      }
    }

    chunkIndex += 1;
    offset = crcStart + 4;
  }

  if (!sawIhdr) {
    fail("PNG has no IHDR chunk");
  }
  if (!sawIend) {
    fail("PNG has no IEND chunk");
  }
  return { width, height };
}

function main(): void {
  if (!existsSync(SOURCE_PATH)) {
    fail(`source image not found at ${SOURCE_PATH}`);
  }
  const size = statSync(SOURCE_PATH).size;
  if (size > MAX_BYTES) {
    fail(`entry.png is ${size} bytes, over the ${MAX_BYTES} byte limit`);
  }

  const bytes = readFileSync(SOURCE_PATH);
  const { width, height } = validatePng(bytes);

  // The destination folder may not exist yet (a fresh local `out/`
  // folder, for example), so create it, including any parents.
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // A plain byte-for-byte copy: the output is the input, unchanged,
  // which is what makes repeated runs deterministic.
  copyFileSync(SOURCE_PATH, OUTPUT_PATH);

  // Prove the copy landed whole: re-read it and compare it byte for
  // byte with the source, so a short write or a disk hiccup is caught
  // here, not by the grader.
  const writtenBytes = readFileSync(OUTPUT_PATH);
  if (!writtenBytes.equals(bytes)) {
    fail(`copy at ${OUTPUT_PATH} differs from the source image`);
  }
  const written = writtenBytes.length;
  console.log(`wrote ${OUTPUT_PATH} (${width}x${height}, ${written} bytes)`);
}

main();
