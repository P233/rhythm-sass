const path = require("node:path");
const sass = require("sass");

const loadPaths = [path.resolve(__dirname, "../src")];

function compile(source) {
  return sass.compileString(source, { loadPaths });
}

function compileWith(config, body = "a { value: rhythm.rhythm(1); }") {
  return compile(`@use "rhythm" as rhythm with (${config}); ${body}`);
}

describe("configuration errors", () => {
  test("treats false as invalid rather than omitted", () => {
    expect(() => compileWith("$baseline-ratio: false")).toThrow(/Invalid \$baseline-ratio/);
    expect(() => compileWith("$ascent: false, $descent: -200")).toThrow(/Invalid \$ascent/);
  });

  test("rejects invalid optional values inside font maps", () => {
    expect(() =>
      compileWith(
        "$baseline-ratio: 0.2",
        "$font: (font-size: 16px, line-height: 3, ascent: 800, descent: -200, units-per-em: false); " +
          "a { value: rhythm.rhythm-top($font, 1); }",
      ),
    ).toThrow(/Invalid units-per-em/);

    expect(() =>
      compileWith(
        "$baseline-ratio: 0.2",
        "$font: (font-size: 16px, line-height: 3, cap-height-ratio: false); " +
          "a { @include rhythm.drop-cap($font, 2); }",
      ),
    ).toThrow(/Invalid cap-height-ratio/);
  });

  test("rejects false as an explicit cap face", () => {
    expect(() =>
      compileWith(
        "$baseline-ratio: 0.2",
        "$font: (font-size: 16px, line-height: 3); a { @include rhythm.drop-cap($font, 2, false); }",
      ),
    ).toThrow(/Invalid \$cap-font-map/);
  });

  test("rejects fractional or negative descender clearance", () => {
    const font = "$font: (font-size: 16px, line-height: 3); ";
    expect(() =>
      compileWith("$baseline-ratio: 0.2", `${font}a { @include rhythm.drop-cap($font, 2, $clear-lines: 0.5); }`),
    ).toThrow(/Invalid \$clear-lines/);
    expect(() =>
      compileWith("$baseline-ratio: 0.2", `${font}a { @include rhythm.drop-cap($font, 2, $clear-lines: -1); }`),
    ).toThrow(/Invalid \$clear-lines/);
  });

  test("requires a positive rem reference size", () => {
    expect(() => compileWith("$baseline-ratio: 0.2, $rem-size: 0px")).toThrow(/must be greater than 0/);
    expect(() => compileWith("$baseline-ratio: 0.2, $rem-size: -16px")).toThrow(/must be greater than 0/);
  });

  test("keeps null as the omitted optional value", () => {
    expect(() =>
      compileWith(
        "$baseline-ratio: null",
        "$font: (font-size: 16px, line-height: 3, baseline-ratio: 0.2); " +
          "a { value: rhythm.rhythm-top($font, 1); }",
      ),
    ).not.toThrow();
  });
});
