# Instrumentum 003 — AcePrep (Basic Pitch → Ace-ready MIDI)

This is a Grey Stratum–styled web utility that:
- imports a vocal stem (audio)
- runs Basic Pitch (in-browser) to extract notes
- displays two diagnostics:
  - [BLOBS] note rectangles (piano-roll)
  - [CONTOUR] pitch trace (quick diagnostic)
- applies simple cleanup (micro-note removal + merge)
- exports a MIDI file suitable for import into Ace Studio

## Local run

Prereqs:
- Node 18+ recommended

Commands:
```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The build output is in `dist/`.

## Deploy under GreyStratum site

This project is configured to be hosted under:
`/protocols/pitchprep/`

That is controlled by `vite.config.js`:

```js
base: '/protocols/pitchprep/'
```

If you deploy to a different path, update `base`.

## Model assets (required)

Place the TFJS model files required by your version of `@spotify/basic-pitch` in:

```
public/models/model.json
public/models/*.bin   (whatever shards model.json references)
```

The app loads the model from:
`/models/model.json`

If you prefer to host the model assets on Azure Blob and reference them via absolute URL, you can change `modelUrl` in `src/App.jsx`.

## Integration into Cantara page

You can add a new instrument card on `cantara.html` pointing to:

`protocols/pitchprep/index.html` (or the folder URL)

Example link:
`<a href="pitchprep/index.html" class="btn-bracket">[ Launch AcePrep ]</a>`
