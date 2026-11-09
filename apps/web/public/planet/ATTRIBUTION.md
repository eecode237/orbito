# Planet textures

Local copies of the Earth surface maps used by `/planet`. Serving them from
`public/` keeps the globe working offline and avoids third-party CDN
dependencies at runtime.

| File | Size | Content | Source |
| --- | --- | --- | --- |
| `earth-blue-marble.jpg` | 4096×2048 | Day surface (Blue Marble, 4K) | `three-globe` example assets (NASA Blue Marble, public domain) via jsDelivr |
| `earth-night.jpg` | 4096×2048 | City lights at night | `three-globe` example assets (NASA Black Marble, public domain) via jsDelivr |
| `earth-topology.png` | 2048×1024 | Relief / elevation | `three-globe` example assets (NASA topography) via jsDelivr |
| `earth-water.png` | 1600×800 | Ocean mask (specular glint) | `three-globe` example assets via jsDelivr |
| `earth-clouds-1024.png` | 1024×512 | Cloud cover | three.js examples `textures/planets` (MIT) |

NASA imagery is public domain. The three.js and `three-globe` example assets
are distributed under their respective open-source licenses.

## Upgrading resolution

Higher-resolution sources (8K Blue Marble, 2K clouds) can be dropped in with the
same filenames or new names in `TEXTURE_URLS` in
`src/components/planet/globe.tsx`. Larger files increase GPU memory use.
