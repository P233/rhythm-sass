# rhythm-sass

[![npm version](https://img.shields.io/npm/v/rhythm-sass)](https://www.npmjs.com/package/rhythm-sass)
[![CI](https://github.com/p233/rhythm-sass/actions/workflows/test.yml/badge.svg)](https://github.com/p233/rhythm-sass/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![rhythm-sass](./docs/logo.png)

Print-inspired vertical rhythm for the web — baseline offsets computed from real font metrics. rhythm-sass lands every text baseline exactly on a vertical rhythm grid, giving front-end developers pixel-perfect control over typographic layout. It builds on concepts introduced by [Plumber](https://jamonserrano.github.io/plumber-sass/); a Rust port for gpui apps is available as [rhythm-gpui](https://github.com/p233/rhythm-gpui).

Unlike Plumber, **no hand-measured baseline ratio is required**: feed the library the `ascent`, `descent`, and `units-per-em` values from the font's metrics tables (the bundled `npx rhythm-sass` command reads them for you) and the ratio is derived automatically. Measured `baseline-ratio` values from [Plumber's tables](https://jamonserrano.github.io/plumber-sass/baselines/) remain fully supported. For a deeper dive, check out [this detailed post](https://peiwen.lu/posts/rhythm-sass).

## Installation

To install rhythm-sass using npm, execute the following command:

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

// Option 2: A measured ratio works exactly as before
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

> **Note:** The `pkg:` URL syntax requires Sass 1.71+ and a bundler that supports it (Vite, webpack 5, etc.). If your toolchain does not support `pkg:` URLs yet, use `"rhythm-sass"` directly.

This library exposes the following global variables:

- `$ascent`, `$descent`, `$units-per-em` specify the primary font's vertical metrics in font units, as reported by its metrics tables. The baseline ratio is derived as `(units-per-em + |descent| - ascent) / (2 * units-per-em)`; descent is accepted in either sign convention. `$units-per-em` defaults to `1000`.

- `$baseline-ratio` specifies the baseline ratio for the primary font directly, e.g. `0.112061` for Noto Serif. Configure either this or the metrics above, not both. All of them may be omitted when every font-map carries its own ratio or metrics.

- `$rhythm-size` specifies the base unit height for the vertical rhythm grid. The default value is `8px`.

- `$rem-size` specifies the reference value for calculating `rem` units, in an absolute length unit. The default value is `16px`. Ignore this setting if you don't use the `rem` unit.

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

Metric-derived ratios may legitimately fall outside `0..1` when a font extends beyond its em box; keep the printed `ascent`/`descent` keys rather than copying such a derived value into `baseline-ratio`. For variable fonts, the command reports the default instance and warns when axis-specific MVAR metrics may differ. WOFF/WOFF2 files must be decompressed to TTF/OTF first (e.g. with fontTools).

## The font-map

This library requires you to define your typography settings in Sass maps, referred to as **font-maps**. Here's an example of a font-map definition:

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

- `line-height` corresponds to the CSS `line-height` property but with a specialized implementation. It accepts only integers, representing the number of rhythm grids. For example, `line-height: 5` equals `5` times the global `$rhythm-size` variable. _Using rhythms for `line-height` ensures proper vertical alignment across multiple lines._

- `ascent`, `descent`, `units-per-em` provide the font's own metrics, overriding the global configuration for this font — the natural choice for a secondary typeface.

- `baseline-ratio` overrides the global configuration with a measured ratio between `0` and `1` instead. A font-map may carry either metrics or `baseline-ratio`, not both.

- `cap-height-ratio` specifies the positive capital height relative to the em size (`sCapHeight / units-per-em`, printed by `npx rhythm-sass`). It can be `1` or greater when capitals extend beyond the em box. It is required by the `cap-top()`/`cap-bottom()` functions and refines the `drop-cap` mixin.

You can include additional CSS properties like `font-family` or `letter-spacing` in your font-map. These extra properties are specifically used with the `font` mixin (explained in a later section); metric keys are never emitted as CSS. However, do not include `padding` and `margin`, as these will be separately calculated by the rhythm-sass functions to determine precise offsets, ensuring text baselines align perfectly with the vertical rhythm grid.

Create a font-map for each type of text, such as headings, subheadings, paragraphs, or code, to keep your typography styles organized and reusable.

## Functions

Functions use the `font-size`, `line-height`, and ratio values from the provided font-map for calculations, producing results in the global `$rhythm-size` unit.

Results are exact to Sass's number precision — offsets are never rounded to whole pixels. Rounding the above/below offsets independently would break the `above + below == line-height` identity that keeps every block on whole rhythm rows; browsers handle fractional lengths through subpixel rendering.

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

`rhythm-bottom()` is an alias for `baseline-top()`, providing a more intuitive naming option. It calculates the spacing from the top of the nth rhythm grid above the baseline to the top of the font's line-height.

### `baseline-bottom($font-map, $rhythms, $offset: 0)` <br/> `rhythm-top($font-map, $rhythms, $offset: 0)`

![rhythm](./docs/fn3.png)

The `baseline-bottom()` function calculates the spacing from the bottom of the font's line-height to the bottom of the nth rhythm grid **below** the baseline. It accepts:

- `$font-map`: The current font map.
- `$rhythms`: The number of rhythm grids between the baseline and the target rhythm grid below it.
- `$offset` (optional): Adjusts the calculated spacing.

`rhythm-top()` is an alias for `baseline-bottom()`, providing a more intuitive naming option. It calculates the spacing from the bottom of the nth rhythm grid below baseline to the bottom of the font's line-height.

### `baseline-between($font-map-above, $font-map-below, $rhythms, $offset: 0)`

![rhythm](./docs/fn4.png)

The `baseline-between()` function calculates the spacing between two fonts, from the bottom of the above font's line-height to the top of the below font's line-height. It accepts:

- `$font-map-above`: The font map of the above element.
- `$font-map-below`: The font map of the below element.
- `$rhythms`: The number of rhythm grids between adjacent text baselines.
- `$offset` (optional): Adjusts the calculated spacing.

### `cap-top($font-map, $rhythms, $offset: 0)` <br/> `cap-bottom($font-map, $rhythms, $offset: 0)`

The `cap-top()` function lands the capital letters' **ink**, rather than the baseline, on the nth grid line — the grid-woven analog of CSS `text-box-trim: trim-start` with `text-box-edge: cap`, for openings where the eye measures ink to edge (heroes, cards, page tops). It requires a `cap-height-ratio` key in the font-map.

A cap-anchored block shifts its baselines off the grid by the fractional part of the cap height, so it must be closed with `cap-bottom()` — not `baseline-bottom()` — which returns at the bottom exactly what `cap-top()` trimmed at the top. The pair makes the block span a whole number of rhythm grids, keeping everything after it in rhythm:

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

## Mixins

### `font($font-map, $spacing-map)`

The `font` mixin efficiently generates font-related CSS properties and calculates spacings. It translates all `$font-map` keys into corresponding CSS properties, except for the metric keys (`baseline-ratio`, `ascent`, `descent`, `units-per-em`, `cap-height-ratio`), facilitating easy style reuse. It also simplifies calling rhythm functions for calculations.

The `$spacing-map` accepts four keys, each corresponding to a CSS property:

- `margin-top`
- `margin-bottom`
- `padding-top`
- `padding-bottom`

These keys use a special syntax to call rhythm functions. Here's how it works:

1. The value for each key is a Sass list.
2. The first item in the list is the function name. Supported function names are: `rhythm`, `baseline-top`, `baseline-bottom`, `cap-top`, `cap-bottom`, and `baseline-between`.
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

For more examples, please refer to the [examples](./examples) folder in the project root.

### `drop-cap($font-map, $lines, $cap-font-map: null, $clear-lines: 0)`

The `drop-cap` mixin solves a drop cap sunk `$lines` lines deep into text set in `$font-map`: it emits the `font-size`, `line-height`, `float`, and baseline anchor that make the capital span from the first line's cap top down to the `$lines`-th baseline. Apply it to a real first-character wrapper so every emitted property, including the relative baseline inset, works consistently:

```html
<p><span class="paragraph-drop-cap">L</span>orem ipsum…</p>
```

```scss
.paragraph-drop-cap {
  @include drop-cap($paragraph-font, 3);

  margin-right: rhythm(1);
}
```

- `$clear-lines` (optional) reserves that many extra wrapped body lines below the letter. Letters with descender tails (Q, J) extend ink below the anchored baseline into the following line's row; `$clear-lines: 1` gives the tail its own clear row. Floats exclude text per whole line box, which is why the unit is body lines rather than rhythms — the clearance is always whole rhythms, so the grid stays intact:

```scss
.paragraph-drop-cap {
  @include drop-cap($paragraph-font, 3, $clear-lines: 1); // room for Q's tail
}
```

- `$cap-font-map` (optional) sets a different face for the capital: a map carrying the cap face's `ascent`/`descent` (or `baseline-ratio`), `cap-height-ratio`, and any extra CSS properties such as `font-family`. Its `font-size` and `line-height` are solved by the mixin and therefore ignored.
- When a map has no `cap-height-ratio`, the classic `0.7em` approximation is used; this can only misplace the visual top — the baseline anchor stays exact.
- The anchor is emitted as a relative inset (`position: relative; top: …`), not a margin: for cap-heavy faces whose capital height exceeds `ascent - descent` (e.g. Merriweather) the anchor is a downward shift, and a margin would push the following content off the grid.

`::first-letter` does not guarantee support for `position`/`top`, so it cannot carry the mixin's exact anchor portably. Browsers with `initial-letter` support can achieve native drop caps without a wrapper; this mixin is the portable, grid-aware alternative.

### `draw-rhythms($color: rgb(255 120 120 / 25%))`

When fine-tuning your typography, visualizing the vertical rhythm grids can be incredibly helpful in ensuring consistency and identifying any alignment issues. The `draw-rhythms()` mixin is a handy tool for visualizing these grids. It reads your global settings and draws the vertical rhythm grids on the `:root` element, making it easy to see how your typography aligns with the overall rhythm.

```scss
// Include this mixin at the top level of your SCSS file.

@if not production {
  @include draw-rhythms;
  // or with a custom color
  @include draw-rhythms(rgb(0 255 255 / 25%));
}
```

Note: Enabling this mixin will set the `position` property of your `:root` element to `relative`. If you have already set your `:root` element to a different positioning value (e.g., `absolute` or `fixed`), using this mixin may affect your existing layout. In such cases, you may need to adjust your `:root` element's positioning or find an alternative way to visualize the rhythm grids.

## Pro Tip

For complex layouts, it's recommended to ensure that all text elements, such as headings, paragraphs, and lists, occupy a whole number of rhythm grids. This means aligning the top and bottom of each element precisely with the vertical rhythm grid lines. By doing this, each text element will neatly fit into the overall rhythm of the layout, making it much easier to combine and arrange elements harmoniously. Line heights are whole grids by construction; close a baseline-anchored block with `baseline-bottom()`, or a cap-anchored block with the paired `cap-bottom()`, and blocks compose freely without breaking the page rhythm.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Credits

This project is inspired by [Plumber](https://jamonserrano.github.io/plumber-sass/).

## License

[MIT](./LICENSE)
