# Polyforge

A web game built with [Three.js](https://threejs.org/), using assets made in Blender.

## Layout

| Path | Contents |
| --- | --- |
| `blender/` | Source `.blend` files (stored with Git LFS) |
| `scripts/export_gltf.py` | Headless Blender script that exports `blender/scene.blend` to glTF |
| `public/models/` | Exported `.glb` files that the game loads |
| `src/` | Game code |

## Setup

```sh
brew install git-lfs && git lfs install   # once per machine
npm install
npm run dev
```

## Exporting from Blender

Save your scene as `blender/scene.blend`, then run:

```sh
npm run export   # needs `blender` on your PATH
```

You can also export by hand: in Blender, go to File → Export → glTF 2.0, choose the `.glb` format, and save it to `public/models/scene.glb`.

## Releasing

Push a version tag. GitHub Actions builds the game and attaches a zip of it to a GitHub Release.

```sh
git tag v0.1.0
git push origin v0.1.0
```

To play a release, unzip it and serve the folder with any static server, for example `npx serve`. Opening `index.html` directly from disk won't work, because browsers block loading the model over `file://`.
