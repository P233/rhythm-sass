# Changelog

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
