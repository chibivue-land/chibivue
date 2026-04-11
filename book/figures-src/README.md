# Book figure assets

The online book serves figure assets from `book/online-book/src/public/figures`.

Use paths that mirror the book structure:

```txt
figures/<chapter>/<article>/<purpose>.<ext>
```

Examples:

- `figures/_brand/logo.png`
- `figures/_people/ubugeeei-avatar.jpg`
- `figures/_sponsors/ubugeeei-sponsors.png`
- `figures/10-minimum-example/reactivity/target-map-structure.svg`
- `figures/20-basic-virtual-dom/patch-keyed-children/inserted-child-keyed-match.svg`
- `figures/50-basic-template-compiler/v-bind/transform-vbind-flow.svg`

Generated explanatory diagrams are SVG files created by `tools/book-figures/generate.mjs`.
Regenerate them with:

```sh
node tools/book-figures/generate.mjs
```

Screenshots should keep their closest article directory and use descriptive names such as `*-result.png`, `*-console.png`, or `*-flow.png`.

Legacy pre-rebrand assets are archived here:

- `legacy-drawio/`: old draw.io source files
- `legacy-raster/`: old exported raster diagrams
- `unreferenced/`: old files that are not currently used by the online book
