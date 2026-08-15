#!/usr/bin/env node
// Zero-dependency font metrics reader: prints the baseline-ratio and
// cap-height-ratio values rhythm-sass needs, straight from TTF/OTF tables.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const HELP = `Usage: rhythm-sass <font-file>...

Reads TTF/OTF/TTC font files and prints the metrics rhythm-sass consumes:
ascent, descent, units-per-em, and the derived baseline-ratio, plus
cap-height-ratio and x-height-ratio when the font declares them.

The baseline ratio is (units-per-em + |descent| - ascent) / (2 * units-per-em).
CSS Inline Layout recommends OS/2 typo metrics when available and hhea as a
fallback, but browser engines and legacy platform APIs can differ. Treat the
rows as candidates and verify the set used by your target runtime. Derived
ratios may fall outside 0..1; keep the printed ascent/descent keys in that case.

Variable-font values are for the default instance; axis-specific MVAR metrics
may differ.

WOFF/WOFF2 files must be decompressed to TTF/OTF first (e.g. with fontTools).`;

const TERMINAL_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu;
const sanitizeText = (value) => String(value).replace(TERMINAL_CONTROLS, "�");

function ensureRange(view, offset, length, label) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset > view.byteLength - length
  ) {
    throw new Error(`${label} is outside the font data`);
  }
}

const u16 = (view, o) => view.getUint16(o);
const i16 = (view, o) => view.getInt16(o);
const u32 = (view, o) => view.getUint32(o);
const tag = (view, o) => {
  ensureRange(view, o, 4, "font tag");
  return String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
};

function isSfntVersion(view, offset) {
  ensureRange(view, offset, 4, "font resource header");
  const kind = tag(view, offset);
  return u32(view, offset) === 0x00010000 || kind === "OTTO" || kind === "true" || kind === "typ1";
}

function parseTableDirectory(view, offset) {
  ensureRange(view, offset, 12, "table directory");
  if (!isSfntVersion(view, offset)) throw new Error("unrecognized font resource in collection");

  const numTables = u16(view, offset + 4);
  ensureRange(view, offset + 12, numTables * 16, "table records");

  const tables = Object.create(null);
  for (let i = 0; i < numTables; i++) {
    const record = offset + 12 + i * 16;
    const tableTag = tag(view, record);
    const tableOffset = u32(view, record + 8);
    const tableLength = u32(view, record + 12);
    ensureRange(view, tableOffset, tableLength, `table ${sanitizeText(tableTag)}`);
    tables[tableTag] = { offset: tableOffset, length: tableLength };
  }
  return tables;
}

function getTableView(view, tables, tableTag, minimumLength) {
  const table = tables[tableTag];
  if (!table) throw new Error(`missing ${tableTag} table`);
  if (table.length < minimumLength) {
    throw new Error(`${tableTag} table is too short (expected at least ${minimumLength} bytes, found ${table.length})`);
  }
  return new DataView(view.buffer, view.byteOffset + table.offset, table.length);
}

// Best-effort full name (nameID 4): Windows UTF-16BE first, then Mac Roman.
// The name is cosmetic, so a malformed header degrades to null and malformed
// records are skipped instead of failing the whole file.
function readFullName(view) {
  if (view.byteLength < 6) return null;
  const count = u16(view, 2);
  const stringOffset = u16(view, 4);
  if (6 + count * 12 > view.byteLength || stringOffset > view.byteLength) return null;

  let fallback = null;
  for (let i = 0; i < count; i++) {
    const record = 6 + i * 12;
    const platformID = u16(view, record);
    const nameID = u16(view, record + 6);
    if (nameID !== 4) continue;
    const length = u16(view, record + 8);
    const start = stringOffset + u16(view, record + 10);
    if (start + length > view.byteLength) continue;
    const bytes = new Uint8Array(view.buffer, view.byteOffset + start, length);
    if (platformID === 3 || platformID === 0) {
      let name = "";
      for (let j = 0; j + 1 < length; j += 2) name += String.fromCharCode((bytes[j] << 8) | bytes[j + 1]);
      return sanitizeText(name);
    }
    if (platformID === 1 && fallback === null) {
      let name = "";
      for (const byte of bytes) name += String.fromCharCode(byte);
      fallback = sanitizeText(name);
    }
  }
  return fallback;
}

function parseOs2(view, tables) {
  if (!("OS/2" in tables)) return null;

  const os2 = getTableView(view, tables, "OS/2", 78);
  const version = u16(os2, 0);
  if (version >= 2 && os2.byteLength < 90) {
    throw new Error(`OS/2 table is too short for version ${version} (expected at least 90 bytes)`);
  }

  return {
    useTypoMetrics: (u16(os2, 62) & 0x80) !== 0,
    typoAscent: i16(os2, 68),
    typoDescent: i16(os2, 70),
    winAscent: u16(os2, 74),
    winDescent: u16(os2, 76),
    xHeight: version >= 2 ? i16(os2, 86) : 0,
    capHeight: version >= 2 ? i16(os2, 88) : 0,
  };
}

function parseFace(view, offset) {
  const tables = parseTableDirectory(view, offset);
  const head = getTableView(view, tables, "head", 54);
  const hhea = getTableView(view, tables, "hhea", 36);
  const upem = u16(head, 18);
  if (upem < 16 || upem > 16384) throw new Error(`invalid units-per-em ${upem} (expected 16..16384)`);

  const hheaAscent = i16(hhea, 4);
  const face = {
    name: "name" in tables ? readFullName(getTableView(view, tables, "name", 0)) : null,
    upem,
    hheaAscent,
    hheaDescent: i16(hhea, 6),
    os2: parseOs2(view, tables),
    variable: "fvar" in tables || "MVAR" in tables,
  };
  return face;
}

function parseFile(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  ensureRange(view, 0, 4, "font header");
  const kind = tag(view, 0);
  if (kind === "wOFF" || kind === "wOF2") {
    throw new Error("WOFF/WOFF2 is compressed; decompress to TTF/OTF first (e.g. with fontTools).");
  }
  if (kind === "ttcf") {
    ensureRange(view, 0, 12, "TTC header");
    const version = u32(view, 4);
    if (version !== 0x00010000 && version !== 0x00020000) {
      throw new Error(`unsupported TTC version 0x${version.toString(16).padStart(8, "0")}`);
    }
    const numFonts = u32(view, 8);
    if (numFonts === 0) throw new Error("TTC contains no font faces");
    ensureRange(view, 12, numFonts * 4, "TTC face offsets");
    const faces = [];
    for (let i = 0; i < numFonts; i++) faces.push(parseFace(view, u32(view, 12 + i * 4)));
    return faces;
  }
  if (isSfntVersion(view, 0)) {
    return [parseFace(view, 0)];
  }
  throw new Error("unrecognized font format (expected TTF, OTF, or TTC)");
}

const baselineRatio = (ascent, descent, upem) => (upem + Math.abs(descent) - ascent) / (2 * upem);
const fmt = (n) => n.toFixed(6);
const heightRatio = (height, upem) => (height > 0 ? fmt(height / upem) : null);
const metricRatio = (ascent, descent, upem) => (ascent > 0 ? fmt(baselineRatio(ascent, descent, upem)) : null);

function report(file, face, index, total) {
  const label = total > 1 ? ` [face ${index + 1}/${total}]` : "";
  const fileName = sanitizeText(basename(file));
  const title = face.name ? `${fileName}${label} — ${face.name}` : `${fileName}${label}`;
  const rows = [["hhea", face.hheaAscent, face.hheaDescent]];
  if (face.os2) {
    rows.push(["OS/2 typo", face.os2.typoAscent, face.os2.typoDescent]);
    rows.push(["OS/2 win", face.os2.winAscent, -face.os2.winDescent]);
  }
  console.log(title);
  console.log(`  units-per-em  ${face.upem}`);
  for (const [source, ascent, descent] of rows) {
    const ratio = metricRatio(ascent, descent, face.upem) ?? "not usable";
    console.log(
      `  ${source.padEnd(12)}  ascent ${String(ascent).padEnd(6)} descent ${String(descent).padEnd(6)} baseline-ratio ${ratio}`,
    );
  }
  const capRatio = face.os2 ? heightRatio(face.os2.capHeight, face.upem) : null;
  const xRatio = face.os2 ? heightRatio(face.os2.xHeight, face.upem) : null;
  console.log(`  cap-height-ratio  ${capRatio ?? "not declared"}`);
  console.log(`  x-height-ratio    ${xRatio ?? "not declared"}`);
  if (face.os2) {
    console.log(`  USE_TYPO_METRICS  ${face.os2.useTypoMetrics ? "set" : "not set"}`);
  }
  if (face.variable) {
    console.log("  variable-font     default instance only; axis-specific MVAR metrics may differ");
  }
  console.log("");
  // CSS Inline Layout prefers OS/2 typo metrics with hhea as the fallback;
  // win values are primarily clipping metrics and stay the last resort.
  const candidate = ["OS/2 typo", "hhea", "OS/2 win"]
    .map((preferred) => rows.find(([source, ascent]) => source === preferred && ascent > 0))
    .find(Boolean);
  if (candidate) {
    const [source, ascent, descent] = candidate;
    console.log(`  Example font-map keys (${source} candidate; verify in the target engine):`);
    console.log(`    ascent: ${ascent},`);
    console.log(`    descent: ${descent},`);
    console.log(`    units-per-em: ${face.upem},`);
    if (capRatio) console.log(`    cap-height-ratio: ${capRatio},`);
  } else {
    console.log("  No usable font-map candidate: rhythm-sass requires a positive ascent.");
  }
  console.log("");
}

function main(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return 0;
  }

  if (args.length === 0) {
    console.error(HELP);
    return 1;
  }

  let failed = false;
  for (const file of args) {
    try {
      const faces = parseFile(readFileSync(file));
      faces.forEach((face, index) => report(file, face, index, faces.length));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${sanitizeText(file)}: ${sanitizeText(message)}`);
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
