Add three PNG files here before deploying:

- icon-192.png (192x192)
- icon-512.png (512x512)
- icon-512-maskable.png (512x512, with safe-zone padding for maskable icons)

Easiest path: take the `favicon.svg` in `public/` (or your own logo) and run it through
https://realfavicongenerator.net or https://maskable.app/editor, then drop the exported
PNGs in this folder using the exact filenames above. The manifest in `vite.config.js`
already points at these paths.
