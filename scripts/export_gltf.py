"""Export each top-level collection in the open .blend file to public/models/<name>.glb.

The game expects collections named Car, Cone and Tires. Inside Car, the wheels
must be objects named Wheel_FL, Wheel_FR, Wheel_RL and Wheel_RR with their
origins at the wheel centres, so the game can steer and spin them.

Usage:
    blender -b blender/rc_assets.blend -P scripts/export_gltf.py
"""
import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "models")


def export_collections(out_dir=OUT_DIR):
    os.makedirs(out_dir, exist_ok=True)
    for col in bpy.context.scene.collection.children:
        objs = list(col.all_objects)
        if not objs:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objs:
            obj.select_set(True)
        path = os.path.join(out_dir, col.name.lower() + ".glb")
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            use_selection=True,
            export_apply=True,  # apply modifiers (bevels etc.)
        )
        print(f"Exported {path}")


if __name__ == "__main__":
    export_collections()
