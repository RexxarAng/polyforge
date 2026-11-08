# Polyforge

A top-down RC car drifting game built with [Three.js](https://threejs.org/), using low-poly assets made in Blender.

Drift around the tyre islands to build points. The longer you hold a drift, the higher the multiplier, up to ×5. If you hit a wall mid-drift, you lose the points you haven't banked yet.

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Throttle |
| S / ↓ | Brake, then reverse |
| A D / ← → | Steer |
| Space | Handbrake (starts a drift) |
| R | Reset car and cones |
| M | Mute |

Gamepads also work: the left stick steers, RT is throttle, LT is brake, and A is the handbrake.

**Drifting tips:** tap the handbrake while turning at speed, then stay on the throttle and steer to hold the slide. You can also turn sharply at full speed to kick the tail out without the handbrake.

## Layout

| Path | Contents |
| --- | --- |
| `src/car.js` | Car physics (arcade drift model) and wheel animation |
| `src/arena.js` | Ground, walls, tyre islands and cone layout |
| `src/effects.js` | Skid marks and tyre smoke |
| `src/sound.js` | Synthesised motor and tyre-screech audio |
| `src/assets.js` | Loads the Blender models, with built-in stand-ins when they're missing |
| `scripts/make_assets.py` | Builds the car, cone and tyre stack in Blender and exports them |
| `scripts/export_gltf.py` | Exports each collection in the `.blend` file to `public/models/<name>.glb` |
| `blender/` | Source `.blend` files (stored with Git LFS) |

## Setup

```sh
brew install git-lfs && git lfs install   # once per machine
npm install
npm run dev
```

## Blender assets

The game runs without any exported models, using built-in stand-ins. To generate the real Blender assets (this needs `blender` on your PATH):

```sh
npm run assets
```

This creates `blender/rc_assets.blend`, which has three collections: **Car**, **Cone** and **Tires**. It also exports `public/models/car.glb`, `cone.glb` and `tires.glb`.

After that, open the `.blend` file in Blender to restyle the assets, then re-export them:

```sh
npm run export
```

Rules for the car:

- The car faces **+Y** in Blender, with Z up.
- The wheels must be objects named `Wheel_FL`, `Wheel_FR`, `Wheel_RL` and `Wheel_RR`, with their origins at the wheel centres. The game uses these names to steer and spin the wheels.
- Keep the car roughly 2 × 1.1 units. Collisions use a 0.9-unit radius.

## Releasing

Push a version tag. GitHub Actions builds the game and attaches a zip of it to a GitHub Release.

```sh
git tag v0.1.0
git push origin v0.1.0
```

To play a release, unzip it and serve the folder with any static server, for example `npx serve`.
