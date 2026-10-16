# rhythm-sass

[![npm version](https://img.shields.io/npm/v/rhythm-sass)](https://www.npmjs.com/package/rhythm-sass)
[![CI](https://github.com/p233/rhythm-sass/actions/workflows/test.yml/badge.svg)](https://github.com/p233/rhythm-sass/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![rhythm-sass](./docs/logo.png)

rhythm-sass is a Sass library for print-inspired vertical rhythm on the web: it computes the spacing that puts every text baseline on a vertical rhythm grid, with baseline offsets derived from the font's own metrics. It builds on concepts introduced by [Plumber](https://jamonserrano.github.io/plumber-sass/), and [rhythm-gpui](https://github.com/p233/rhythm-gpui) ports it to Rust for gpui apps.

No baseline ratio has to be measured by hand: rhythm-sass derives it from the `ascent`, `descent` and `units-per-em` values in the font's metrics tables, which the bundled `npx rhythm-sass` command reads for you. A measured `baseline-ratio` still works, and [the rhythm-sass post](https://peiwen.lu/posts/rhythm-sass) explains the model behind the ratio.

rhythm-sass works in Sass at build time and covers type and the spacing around it. It does not fit images or other media to the grid, and it does not correct for how each browser rounds a baseline; [Functions](#functions) explains where browsers differ.

## Installation

Install it from npm:

```
npm install --save-dev rhythm-sass
```

## Usage

```scss
// Option 1: Use directly in your stylesheet
@use "pkg:rhythm-sass" as * with (
  $ascent: 1069,               // Noto Serif hhea metrics
  $descent: -293,
  $units-per-em: 1000,         // optional, defaults to 1000
  $rhythm-size: 8px,           // optional
  $rem-size: 16px              // optional
);

// Option 2: A measured ratio instead of metrics
@use "pkg:rhythm-sass" as * with (
  $baseline-ratio: 0.112061    // mutually exclusive with $ascent/$descent
);

// Option 3: Forward with custom settings to be used in other files
@forward "pkg:rhythm-sass" with (
  $ascent: 1069,
  $descent: -293
);

// Set the primary font size and family
:root {
  font: 16px/1 "Noto Serif", serif;
}
```

> **Note:** The `pkg:` URL syntax requires Sass 1.71+ and a bundler that supports it, such as Vite or webpack 5. If your toolchain does not support `pkg:` URLs yet, use `"rhythm-sass"` directly.

This library exposes the following global variables:

- `$ascent`, `$descent`, `$units-per-em` specify the primary font's vertical metrics in font units, as reported by its metrics tables. The baseline ratio is derived as `(units-per-em + |descent| - ascent) / (2 * units-per-em)`; descent is accepted in either sign convention. `$units-per-em` defaults to `1000`.

- `$baseline-ratio` specifies the baseline ratio for the primary font directly, such as `0.112061` for Noto Serif. Configure either this or the metrics above, not both. All of them may be omitted when every font-map carries its own ratio or metrics.

- `$rhythm-size` specifies the base unit height for the vertical rhythm grid. The default value is `8px`.

- `$rem-size` specifies the reference value for calculating `rem` units, in an absolute length unit. The default value is `16px`. Ignore this setting if you do not use the `rem` unit.

## Measuring fonts

The package ships a zero-dependency command that reads TTF/OTF/TTC files and prints everything rhythm-sass consumes:

```
npx rhythm-sass path/to/NotoSerif.ttf
```

```
NotoSerif.ttf — Noto Serif Regular
  units-per-em  1000
  hhea          ascent 1069   descent -293   baseline-ratio 0.112000
  OS/2 typo     ascent 1069   descent -293   baseline-ratio 0.112000
  OS/2 win      ascent 1069   descent -389   baseline-ratio 0.160000
  cap-height-ratio  0.714000
  x-height-ratio    0.536000
  USE_TYPO_METRICS  set

  Example font-map keys (OS/2 typo candidate; verify in the target engine):
    ascent: 1069,
    descent: -293,
    units-per-em: 1000,
    cap-height-ratio: 0.714000,
```

A font carries several candidate sets of vertical metrics. [CSS Inline Layout](https://www.w3.org/TR/css-inline-3/#ascent-descent) recommends `OS/2` typo metrics when available and `hhea` as a fallback, but browser engines and legacy platform APIs can differ; `USE_TYPO_METRICS` is a signal, not a universal selector. Compare the rows and verify the metric set used by your target runtime. `OS/2` win values are primarily clipping metrics.

Metric-derived ratios may legitimately fall outside `0..1` when a font extends beyond its em box (such as Noto Nastaliq Urdu or math extension faces); the command flags such rows inline. Keep the printed `ascent`/`descent` keys in that case, since `baseline-ratio` accepts only measured values between `0` and `1`. For variable fonts, the command reports the default instance and warns when axis-specific MVAR metrics may differ. WOFF/WOFF2 files must be decompressed to TTF/OTF first, with fontTools for example.

## The font-map

This library reads your typography settings from Sass maps called **font-maps**. For example:

```scss
$heading-font: (
  font-size: 32px,             // required
  line-height: 5,              // required
  font-family: "Georgia",      // optional
  ascent: 1878,                // optional, with descent
  descent: -449,               // optional, with ascent
  units-per-em: 2048,          // optional, defaults to 1000
  cap-height-ratio: 0.692871   // optional, enables cap-top/cap-bottom
);
```

- `font-size` corresponds to the CSS `font-size` property. Any absolute length unit or `rem` is accepted and converted to the `$rhythm-size` unit automatically.

- `line-height` corresponds to the CSS `line-height` property, counted in rhythm grids: it accepts only integers, and `line-height: 5` is five times the global `$rhythm-size`. Whole rhythms keep every following line of a block on the grid.

- `ascent`, `descent`, `units-per-em` provide the font's own metrics, overriding the global configuration for this font; a secondary typeface usually needs them.

- `baseline-ratio` overrides the global configuration with a measured ratio between `0` and `1` instead. A font-map may carry either metrics or `baseline-ratio`, not both.

- `cap-height-ratio` specifies the positive capital height relative to the em size (`sCapHeight / units-per-em`, printed by `npx rhythm-sass`). It can be `1` or greater when capitals extend beyond the em box. It is required by the `cap-top()`/`cap-bottom()` functions and refines the `drop-cap` mixin.

A font-map may also carry other CSS properties, such as `font-family` or `letter-spacing`. The [`font`](#fontfont-map-spacing-map) mixin emits them and never emits the metric keys. Leave out `padding` and `margin`: the spacing functions calculate them.

Create a font-map for each type of text, such as headings, subheadings, paragraphs or code, to keep your typography styles organized and reusable.

## Functions

Functions use the `font-size`, `line-height` and ratio values from the provided font-map for calculations, producing results in the global `$rhythm-size` unit.

Results are exact to Sass's number precision: offsets are never rounded to whole pixels. Rounding the above/below offsets independently would break the `above + below == line-height` identity that keeps every block on whole rhythm rows.

Browsers do not all paint a fractional baseline on the same pixel, though. Measured on macOS, Chromium rounds a font's ascent and descent to whole pixels before centering them in the line box, Firefox rounds them up, and WebKit keeps the exact value. Many sizes land on the same pixel in all three. Where one does not, as can happen with a large drop cap, [`drop-cap-metrics()`](#drop-cap-metricsfont-map-lines-cap-font-map-null) exposes the solved values so a stylesheet can adjust them.

### `rhythm($rhythms, $offset: 0)`

![rhythm](./docs/fn1.png)

The `rhythm()` function calculates the total height of a specified number of rhythm grids. It accepts two arguments:

- `$rhythms`: The number of rhythm grids
- `$offset` (optional): Adjusts the calculated result for additional sizing factors, such as border width. Must carry a length unit.

For example, if you want to add a top padding of `5` rhythm grids to an element with a `1px` top border, the actual `padding-top` should be `39px` instead of `40px` (assuming an 8px rhythm). You can calculate the correct padding using a `-1px` offset parameter:

```scss
padding-top: rhythm(5, -1px);
```

The offset unit is automatically handled by the function. If different units are used, the function will output the result in the `calc()` format.

### `baseline-top($font-map, $rhythms, $offset: 0)` <br/> `rhythm-bottom($font-map, $rhythms, $offset: 0)`

![rhythm](./docs/fn2.png)

The `baseline-top()` function calculates the spacing from the top of the font's line-height to the top of the nth rhythm grid **above** the baseline. It accepts:

- `$font-map`: The current font map.
- `$rhythms`: The number of rhythm grids between the baseline and the target rhythm grid above it.
- `$offset` (optional): Adjusts the calculated spacing.

`rhythm-bottom()` is the same function under a name that reads from the grid line: the spacing from the top of the nth rhythm grid above the baseline to the top of the font's line-height.

### `baseline-bottom($font-map, $rhythms, $offset: 0)` <br/> `rhythm-top($font-map, $rhythms, $offset: 0)`

![rhythm](./docs/fn3.png)

The `baseline-bottom()` function calculates the spacing from the bottom of the font's line-height to the bottom of the nth rhythm grid **below** the baseline. It accepts:

- `$font-map`: The current font map.
- `$rhythms`: The number of rhythm grids between the baseline and the target rhythm grid below it.
- `$offset` (optional): Adjusts the calculated spacing.

`rhythm-top()` is the same function under a name that reads from the grid line: the spacing from the bottom of the nth rhythm grid below the baseline to the bottom of the font's line-height.

### `baseline-between($font-map-above, $font-map-below, $rhythms, $offset: 0)`

![rhythm](./docs/fn4.png)

The `baseline-between()` function calculates the spacing between two fonts, from the bottom of the above font's line-height to the top of the below font's line-height. It accepts:

- `$font-map-above`: The font map of the above element.
- `$font-map-below`: The font map of the below element.
- `$rhythms`: The number of rhythm grids between adjacent text baselines.
- `$offset` (optional): Adjusts the calculated spacing.

### `cap-top($font-map, $rhythms, $offset: 0)` <br/> `cap-bottom($font-map, $rhythms, $offset: 0)`

The `cap-top()` function lands the capital letters' **ink**, rather than the baseline, on the nth grid line. It is the grid-woven analog of CSS `text-box-trim: trim-start` with `text-box-edge: cap`, for openings where the eye measures ink to edge (heroes, cards, page tops). It requires a `cap-height-ratio` key in the font-map.

A cap-anchored block shifts its baselines off the grid by the fractional part of the cap height, so it must be closed with `cap-bottom()` rather than `baseline-bottom()`. `cap-bottom()` returns at the bottom exactly what `cap-top()` trimmed at the top, and the pair makes the block span a whole number of rhythm grids, keeping everything after it in rhythm:

```scss
.hero-heading {
  @include font(
    $heading-font,
    (
      padding-top: cap-top 3,
      padding-bottom: cap-bottom 1
    )
  );
}
```

### `drop-cap-metrics($font-map, $lines, $cap-font-map: null)`

The `drop-cap-metrics()` function returns the solution the [`drop-cap`](#drop-capfont-map-lines-cap-font-map-null-clear-lines-0) mixin emits, as a map with `font-size`, `line-height` and `top` keys. Use it when a stylesheet needs the values themselves, for example to check where each browser paints the capital and adjust its size before applying it. `$lines` and `$cap-font-map` work as in the mixin; `$clear-lines` only adds a margin, so it has no counterpart here.

```scss
@use "sass:map";

$cap: drop-cap-metrics($paragraph-font, 3);

.paragraph-drop-cap {
  float: left;
  position: relative;
  top: map.get($cap, top);
  font-size: map.get($cap, font-size);
  line-height: map.get($cap, line-height);
}
```

## Mixins

### `font($font-map, $spacing-map)`

The `font` mixin emits a font-map as CSS: `font-size`, `line-height` in rhythm grids and every other key except the metric keys (`baseline-ratio`, `ascent`, `descent`, `units-per-em` and `cap-height-ratio`). Its `$spacing-map` resolves margins and paddings through the rhythm functions.

The `$spacing-map` accepts four keys, each corresponding to a CSS property:

- `margin-top`
- `margin-bottom`
- `padding-top`
- `padding-bottom`

These keys use a special syntax to call rhythm functions:

1. The value for each key is a Sass list.
2. The first item in the list is the function name: `rhythm` or `baseline-between` for any key, `baseline-top` or `cap-top` for the top keys and `baseline-bottom` or `cap-bottom` for the bottom keys.
3. The remaining items are the function arguments.
4. For all functions except `rhythm`, the current `$font-map` is automatically injected and should be omitted from the arguments. For `rhythm`, no font-map is needed and the arguments are passed directly.
5. When calling the `baseline-between` function:
   - For `padding-top` and `margin-top`, the current `$font-map` is treated as `$font-map-below`.
   - For `padding-bottom` and `margin-bottom`, the current `$font-map` is treated as `$font-map-above`.

Example usage:

```scss
$paragraph-font-map: (
  font-size: 20px,
  line-height: 4,
);

$quote-font-map: (
  font-size: 18px,
  line-height: 3,
  font-style: italic
);

.quote {
  @include font($quote-font-map, (
    margin-top: baseline-between $paragraph-font-map 3,
    padding-top: rhythm 1,
    padding-bottom: baseline-bottom 3
  ));
}
```

In this example:

- `margin-top` value is translated to `baseline-between($paragraph-font-map, $quote-font-map, 3)`.
- `padding-top` value is translated to `rhythm(1)`.
- `padding-bottom` value is translated to `baseline-bottom($quote-font-map, 3)`.

The [examples](./examples) folder has a complete page.

### `drop-cap($font-map, $lines, $cap-font-map: null, $clear-lines: 0)`

The `drop-cap` mixin solves a drop cap sunk `$lines` lines deep into text set in `$font-map`: it emits the `font-size`, `line-height`, `float` and baseline anchor that make the capital span from the first line's cap top down to the `$lines`-th baseline. Apply it to a real first-character wrapper so every emitted property, including the relative baseline inset, works consistently:

```html
<p><span class="paragraph-drop-cap">L</span>orem ipsum…</p>
```

```scss
.paragraph-drop-cap {
  @include drop-cap($paragraph-font, 3);

  margin-right: rhythm(1);
}
```

- `$clear-lines` (optional) reserves that many extra wrapped body lines below the letter. Letters with descender tails (Q, J) extend ink below the anchored baseline into the following line's row; `$clear-lines: 1` gives the tail its own clear row. Floats exclude text per whole line box, which is why the unit is body lines rather than rhythms; the clearance is always whole rhythms, and the grid stays intact:

```scss
.paragraph-drop-cap {
  @include drop-cap($paragraph-font, 3, $clear-lines: 1); // room for Q's tail
}
```

- `$cap-font-map` (optional) sets a different face for the capital: a map carrying the cap face's `ascent`/`descent` (or `baseline-ratio`), `cap-height-ratio` and any extra CSS properties such as `font-family`. Its `font-size` and `line-height` are solved by the mixin and therefore ignored.
- When a map has no `cap-height-ratio`, the classic `0.7em` approximation is used. It can misplace only the visual top, and the baseline anchor stays exact.
- The anchor is emitted as a relative inset (`position: relative; top: …`), not a margin: for cap-heavy faces whose capital height exceeds `ascent - descent`, such as Merriweather, the anchor is a downward shift, and a margin would push the following content off the grid.

`::first-letter` does not guarantee support for `position`/`top`, so it cannot carry the mixin's exact anchor portably. Browsers with `initial-letter` support can achieve native drop caps without a wrapper; this mixin is the portable, grid-aware alternative.

### `draw-rhythms($color: rgb(255 120 120 / 25%))`

The `draw-rhythms()` mixin draws the vertical rhythm grid over the page from your global settings, so you can see where text sits against it while you tune the typography.

```scss
// Include this mixin at the top level of your SCSS file; $production is your own flag.

@if not $production {
  @include draw-rhythms;
  // or with a custom color
  @include draw-rhythms(rgb(0 255 255 / 25%));
}
```

The mixin sets `position: relative` on `:root`. Before enabling it, check that your layout does not depend on another `position` value there.

## Keeping blocks on whole rows

Give every text block, such as a heading, paragraph or list, a height of whole rhythm grids, with its top and bottom edges on grid lines. Blocks then stack in any order without moving the rhythm of the page. Line heights are whole grids already; close a baseline-anchored block with `baseline-bottom()`, or a cap-anchored block with the paired `cap-bottom()`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Credits

This project is inspired by [Plumber](https://jamonserrano.github.io/plumber-sass/).

## License

[MIT](./LICENSE)
