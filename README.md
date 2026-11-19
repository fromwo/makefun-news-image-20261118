[![news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/c/news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/fromwo/makefun-news-image-20261118/rank.svg)](https://make.fun/c/news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/fromwo/makefun-news-image-20261118/reward.svg)](https://make.fun/c/news-image-20261118)

# One Image: Wednesday 18 November 2026 in World News

A single newspaper-style front page that sums up the whole of Wednesday,
18 November 2026, from morning to night. The masthead reads
"WORLD NEWS — WEDNESDAY 18 NOVEMBER 2026", and six panels below it cover
the day's biggest stories across regions and beats:

1. **APEC summit in Shenzhen** — Xi Jinping meets Vladimir Putin on the
   sidelines of APEC, a day before their planned trilateral talks with
   Donald Trump, who arrived in China the same day.
2. **Quad leaders meet in Manila** — the first leader-level Quad meeting
   in more than two years, alongside a new US–Philippines trade deal.
3. **Drones over the Gulf** — Iran says it launched drones at US forces
   at Ali Al Salem Air Base in Kuwait; Bahrain reports intercepting
   several attacks before dawn.
4. **Gaza operation and UK sanctions** — Israel begins a concentrated
   operation in three areas of central Gaza, while Britain sanctions
   firms linked to West Bank settlement expansion and a group blocking
   aid into Gaza.
5. **Nvidia record, Anthropic IPO** — Nvidia reports a record fiscal
   third quarter ($115.8B revenue, up 103% year over year) while
   Anthropic prices its IPO, expected above its $70–78 range.
6. **GTA VI launches worldwide** — Rockstar's Grand Theft Auto VI goes
   live in a rolling midnight launch, starting in New Zealand, 13 years
   after GTA V.

Every story on the page is a real event reported on 18 November 2026.
The image was generated fresh for round 2 of this competition.

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node.js, standard library only, no network) validates the
image in this repository and copies it unchanged to the output
directory as `entry.png`. If `MAKEFUN_OUTPUT_DIR` is not set it
defaults to `./out`.

The validation checks:

- the file starts with the PNG magic bytes `89 50 4E 47 0D 0A 1A 0A`;
- the file is at most 1,048,576 bytes;
- the IHDR dimensions are at most 1024×1024 (this image is 1024×1024);
- every chunk is walked in order and its CRC-32 is verified, using a
  CRC-32 table built from scratch in the program;
- an IDAT chunk carrying image data is present, and the IEND chunk
  exists, is empty, and is the last chunk.

Any failed check prints an error and exits non-zero; nothing is copied.

## Files

- `entry.png` — the front-page image (1024×1024 PNG).
- `main.ts` — the validator and copier described above.
- `README.md` — this file.
- `LICENSE` — MIT license.
- `.makefun/owner.json` — competition ownership metadata.

## License

MIT — see `LICENSE`.
