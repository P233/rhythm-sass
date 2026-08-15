const { spawn, spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const cliPath = path.resolve(__dirname, "../bin/rhythm-sass.mjs");
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "rhythm-sass-cli-"));

const align4 = (value) => (value + 3) & ~3;

function buildNameTable(name) {
  const string = Buffer.from(name, "utf16le").swap16();
  const table = Buffer.alloc(18 + string.length);
  table.writeUInt16BE(1, 2);
  table.writeUInt16BE(18, 4);
  table.writeUInt16BE(3, 6);
  table.writeUInt16BE(1, 8);
  table.writeUInt16BE(0x0409, 10);
  table.writeUInt16BE(4, 12);
  table.writeUInt16BE(string.length, 14);
  string.copy(table, 18);
  return table;
}

function buildFont({
  name = "Test Face",
  signature = 0x00010000,
  unitsPerEm = 1000,
  hheaAscent = 800,
  typoAscent = 780,
  capHeight = 700,
  variable = false,
  nameTable = null,
} = {}) {
  const head = Buffer.alloc(54);
  head.writeUInt16BE(unitsPerEm, 18);

  const hhea = Buffer.alloc(36);
  hhea.writeUInt32BE(0x00010000, 0);
  hhea.writeInt16BE(hheaAscent, 4);
  hhea.writeInt16BE(-200, 6);

  const os2 = Buffer.alloc(96);
  os2.writeUInt16BE(2, 0);
  os2.writeUInt16BE(0x80, 62);
  os2.writeInt16BE(typoAscent, 68);
  os2.writeInt16BE(-220, 70);
  os2.writeUInt16BE(900, 74);
  os2.writeUInt16BE(250, 76);
  os2.writeInt16BE(500, 86);
  os2.writeInt16BE(capHeight, 88);

  const tables = [
    ["head", head],
    ["hhea", hhea],
    ["name", nameTable ?? buildNameTable(name)],
    ["OS/2", os2],
  ];
  if (variable) tables.push(["fvar", Buffer.alloc(0)]);

  const directoryLength = 12 + tables.length * 16;
  let nextOffset = align4(directoryLength);
  const entries = tables.map(([tableTag, data]) => {
    const entry = { tableTag, data, offset: nextOffset };
    nextOffset = align4(nextOffset + data.length);
    return entry;
  });

  const font = Buffer.alloc(nextOffset);
  if (typeof signature === "string") font.write(signature, 0, 4, "ascii");
  else font.writeUInt32BE(signature, 0);
  font.writeUInt16BE(entries.length, 4);

  entries.forEach(({ tableTag, data, offset }, index) => {
    const record = 12 + index * 16;
    font.write(tableTag, record, 4, "ascii");
    font.writeUInt32BE(offset, record + 8);
    font.writeUInt32BE(data.length, record + 12);
    data.copy(font, offset);
  });

  return font;
}

function buildCollection(fonts) {
  let nextOffset = align4(12 + fonts.length * 4);
  const entries = fonts.map((font) => {
    const entry = { font: Buffer.from(font), offset: nextOffset };
    nextOffset = align4(nextOffset + font.length);
    return entry;
  });

  const collection = Buffer.alloc(nextOffset);
  collection.write("ttcf", 0, 4, "ascii");
  collection.writeUInt32BE(0x00010000, 4);
  collection.writeUInt32BE(entries.length, 8);

  entries.forEach(({ font, offset }, index) => {
    collection.writeUInt32BE(offset, 12 + index * 4);
    const tableCount = font.readUInt16BE(4);
    for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
      const record = 12 + tableIndex * 16;
      font.writeUInt32BE(font.readUInt32BE(record + 8) + offset, record + 8);
    }
    font.copy(collection, offset);
  });

  return collection;
}

function fixture(name, contents) {
  const file = path.join(temporaryDirectory, name);
  writeFileSync(file, contents);
  return file;
}

function run(...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

const ttfPath = fixture("test.ttf", buildFont());
const otfPath = fixture("test.otf", buildFont({ name: "OpenType Face", signature: "OTTO" }));
const collectionPath = fixture(
  "test.ttc",
  buildCollection([buildFont({ name: "Collection One" }), buildFont({ name: "Collection Two" })]),
);
const variablePath = fixture("variable.ttf", buildFont({ capHeight: 1100, variable: true }));
const hostileNamePath = fixture("hostile.ttf", buildFont({ name: "\u001b]0;OWNED\u0007" }));
const unusableTypoPath = fixture("unusable-typo.ttf", buildFont({ typoAscent: 0 }));
const unusableTypoHheaPath = fixture("unusable-typo-hhea.ttf", buildFont({ typoAscent: 0, hheaAscent: 0 }));
const invalidUpemPath = fixture("invalid-upem.ttf", buildFont({ unitsPerEm: 0 }));

const overrunName = buildNameTable("Good Name");
overrunName.writeUInt16BE(0xffff, 14); // declared string length overruns the table
const overrunNamePath = fixture("overrun-name.ttf", buildFont({ nameTable: overrunName }));
const woffPath = fixture("compressed.woff", Buffer.from("wOFF"));

const shortHead = buildFont();
shortHead.writeUInt32BE(1, 24);
const shortHeadPath = fixture("short-head.ttf", shortHead);

const emptyCollection = Buffer.alloc(12);
emptyCollection.write("ttcf", 0, 4, "ascii");
emptyCollection.writeUInt32BE(0x00010000, 4);
const emptyCollectionPath = fixture("empty.ttc", emptyCollection);

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("rhythm-sass CLI", () => {
  test("reports help and missing-argument statuses", () => {
    const help = run("--help");
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: rhythm-sass");

    const missing = run();
    expect(missing.status).toBe(1);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain("Usage: rhythm-sass");
  });

  test("reads TTF, OTF, and multi-face TTC files", () => {
    const standalone = run(ttfPath, otfPath);
    expect(standalone.status).toBe(0);
    expect(standalone.stdout).toContain("Test Face");
    expect(standalone.stdout).toContain("OpenType Face");

    const collection = run(collectionPath);
    expect(collection.status).toBe(0);
    expect(collection.stdout).toContain("[face 1/2] — Collection One");
    expect(collection.stdout).toContain("[face 2/2] — Collection Two");
  });

  test("rejects declared table overreads and empty collections", () => {
    const shortTable = run(shortHeadPath);
    expect(shortTable.status).toBe(1);
    expect(shortTable.stderr).toMatch(/head table is too short/);

    const empty = run(emptyCollectionPath);
    expect(empty.status).toBe(1);
    expect(empty.stderr).toMatch(/contains no font faces/);
  });

  test("rejects compressed input and invalid units-per-em", () => {
    const compressed = run(woffPath);
    expect(compressed.status).toBe(1);
    expect(compressed.stderr).toMatch(/decompress to TTF\/OTF/);

    const invalidUpem = run(invalidUpemPath);
    expect(invalidUpem.status).toBe(1);
    expect(invalidUpem.stderr).toMatch(/invalid units-per-em 0/);
  });

  test("prefers OS/2 typo metrics and falls back down the candidate ladder", () => {
    const spec = run(ttfPath);
    expect(spec.status).toBe(0);
    expect(spec.stdout).toContain("Example font-map keys (OS/2 typo candidate");
    expect(spec.stdout).toContain("ascent: 780,");

    const hheaFallback = run(unusableTypoPath);
    expect(hheaFallback.status).toBe(0);
    expect(hheaFallback.stdout).toMatch(/OS\/2 typo.*baseline-ratio not usable/);
    expect(hheaFallback.stdout).toContain("Example font-map keys (hhea candidate");
    expect(hheaFallback.stdout).toContain("ascent: 800,");

    const winFallback = run(unusableTypoHheaPath);
    expect(winFallback.status).toBe(0);
    expect(winFallback.stdout).toContain("Example font-map keys (OS/2 win candidate");
    expect(winFallback.stdout).toContain("ascent: 900,");
  });

  test("degrades to the file name when the name table is malformed", () => {
    const result = run(overrunNamePath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("overrun-name.ttf");
    expect(result.stdout).not.toContain("Good Name");
    expect(result.stdout).toContain("units-per-em  1000");
  });

  test("sanitizes terminal controls in font names", () => {
    const result = run(hostileNamePath);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(/[\u001b\u0007]/u);
    expect(result.stdout).toContain("�]0;OWNED�");
  });

  test("accepts over-em cap heights and flags variable defaults", () => {
    const result = run(variablePath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cap-height-ratio  1.100000");
    expect(result.stdout).toContain("default instance only");
  });

  test("continues after a file error and returns failure", () => {
    const missing = path.join(temporaryDirectory, "missing.ttf");
    const result = run(missing, ttfPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing.ttf");
    expect(result.stdout).toContain("Test Face");
  });

  test(
    "flushes piped output before exiting",
    async () => {
      const single = run(ttfPath);
      expect(single.status).toBe(0);

      const repetitions = 400;
      const child = spawn(process.execPath, [cliPath, ...Array(repetitions).fill(ttfPath)]);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.pause();

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      const status = await new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
        setTimeout(() => child.stdout.resume(), 100);
      });

      expect(status).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toBe(single.stdout.repeat(repetitions));
    },
    10000,
  );
});
