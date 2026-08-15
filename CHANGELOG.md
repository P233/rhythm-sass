# Changelog

## [2.0.0] - 2026-08-15

### Breaking
- Baseline offsets are no longer rounded to whole pixels in `px` mode. Rounding the above/below offsets independently could break the `above + below == line-height` identity (shifting everything below a block by up to 1px) and placed baselines up to 0.5px off-grid on high-DPI displays. Offsets are now exact in every unit; `rem` output is unchanged.
- Unitless non-zero `$offset` values are rejected. They previously produced invalid CSS such as `calc(40px + 3)`.
- The global `$baseline-ratio` is no longer required at load time. An error is raised only when a font-map actually needs the global fallback and none is configured.
- `$rem-size` must be an absolute length (a `rem` value was previously accepted but circular).

### Added
- Baseline ratios can now be derived from real font metrics — no more hand-measured values. Configure the globals `$ascent`/`$descent`/`$units-per-em`, or add `ascent`/`descent`/`units-per-em` keys to individual font-maps; the ratio is computed as `(units-per-em + |descent| - ascent) / (2 * units-per-em)`. Metrics and `baseline-ratio` are mutually exclusive per scope. Derived ratios may legitimately fall outside `0..1` for fonts whose metrics extend beyond the em box (e.g. Noto Nastaliq Urdu) and are accepted as-is; hand-entered `baseline-ratio` values remain restricted to `0..1`.
- `npx rhythm-sass <font-file>` — a zero-dependency CLI that reads TTF/OTF/TTC metrics tables and prints ascent/descent/units-per-em, the derived baseline ratios (hhea, OS/2 typo, OS/2 win), cap/x-height ratios, and the `USE_TYPO_METRICS` flag. It validates table boundaries and collection metadata, sanitizes terminal control characters in font names, flushes piped output before exiting, and flags variable fonts whose reported metrics describe only the default instance.
- `cap-top()` and `cap-bottom()` functions land the capital letters' ink on a grid line (the grid-aware analog of CSS `text-box-trim`), driven by a new optional `cap-height-ratio` font-map key (any positive value; capitals may extend beyond the em box). The pair keeps cap-anchored blocks on whole rhythm rows. Both are supported in the `font` mixin's `$spacing-map`.
- `drop-cap($font-map, $lines, $cap-font-map: null, $clear-lines: 0)` mixin solves a drop cap's font size and baseline anchor from metrics, with optional distinct cap face; `$clear-lines` reserves extra wrapped lines below the letter for descender tails (Q, J). The anchor is emitted as a relative inset so cap-heavy faces cannot push the following content off the grid; apply the mixin to a real first-character wrapper, because `::first-letter` does not portably support the relative positioning the anchor needs.
- `font-size` values in any absolute length unit are now converted losslessly between absolute units; `$rem-size` is only needed for `rem` conversions.
- Invariant tests asserting the identities that keep blocks on whole rhythm rows, plus test vectors shared with the rhythm-gpui port.

### Changed
- The `px-unit` and `rem-unit` examples are merged into a single rem-based example: with exact offsets the two unit paths behave identically, so the split only duplicated maintenance. The merged example demonstrates metrics configuration, cross-unit `font-size` conversion (a `px` font-map inside the rem grid), and the descender-cleared drop cap.

### Fixed
- Optional font-map values now treat `null` as omitted, while invalid values like `baseline-ratio: false` fail validation with a clear message instead of slipping through truthiness checks and erroring later in arithmetic.
- `$rem-size` rejects zero or negative reference lengths.

## [1.1.3] - 2026-03-02

### Fixed
- Fix `font` mixin incorrectly passing `$font-map` to `rhythm()` when used in `$spacing-map`

### Added
- Add CI workflow via GitHub Actions
- Add `lint:check` script for use in CI environments

### Changed
- Add `sass` field and `exports` with `sass` condition to `package.json` for modern toolchain compatibility
- Expand `keywords` in `package.json` for better discoverability
- Add `engines` field specifying Node.js `>=18`
- Update documentation: `@use "pkg:rhythm-sass"` syntax, `font` mixin supported function names

## [1.1.2] - 2026-01-26

### Changed
- Replace deprecated Sass `if()` calls with `meta.if()` equivalents
- Upgrade all dependencies to latest versions

## [1.1.1] - 2026-01-21

### Changed
- Enhance validation functions in `_lib.scss` for stricter input checking
- Expand test coverage for validation and calculation functions
- Update Jest test environment configuration
- Update documentation

## [1.1.0] - 2024-12-25

### Changed
- Update Husky git hook configuration
- Update Stylelint configuration
- Transfer repository to GitHub organization

## [1.0.1] - 2024-10-23

### Fixed
- Minor fixes following initial release

## [1.0.0] - 2024-10-22

### Added
- Initial release
- `rhythm()`, `baseline-top()`, `baseline-bottom()`, `baseline-between()` functions
- `rhythm-top()` and `rhythm-bottom()` aliases
- `font()` mixin for declarative font and spacing declarations
- `draw-rhythms()` mixin for visualizing the rhythm grid
- Support for `px` and `rem` units with automatic conversion
- Per-font `baseline-ratio` override via font-map
