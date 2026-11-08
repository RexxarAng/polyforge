"""Export the open .blend file to public/models/scene.glb.

Usage:
    blender -b blender/scene.blend -P scripts/export_gltf.py
"""
import os
import bpy

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "models", "scene.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,       # apply modifiers
    export_animations=True,
    export_draco_mesh_compression_enable=False,
)
print(f"Exported {out}")
