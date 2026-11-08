"""Build the game's low-poly assets in Blender, save them, and export them as glTF.

Usage:
    blender -b -P scripts/make_assets.py              # first time
    blender -b -P scripts/make_assets.py -- --force   # overwrite an existing .blend

Creates blender/rc_assets.blend and public/models/{car,cone,tires}.glb.
After the first run, edit the .blend in Blender and re-export with
scripts/export_gltf.py instead, so your changes are not overwritten.

Blender is Z-up with the car facing +Y; the glTF exporter converts this to
the game's Y-up, -Z-forward space.
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from export_gltf import ROOT, export_collections  # noqa: E402

BLEND_PATH = os.path.join(ROOT, "blender", "rc_assets.blend")


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)


def material(name, color, roughness=0.5, metallic=0.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[key].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def use_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    layer = bpy.context.view_layer.layer_collection.children[col.name]
    bpy.context.view_layer.active_layer_collection = layer
    return col


def finish(obj, name, mat, bevel=0.0, smooth=False):
    obj.name = name
    obj.data.materials.append(mat)
    # Bake rotation/scale into the mesh but keep the origin where it was placed.
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    if smooth:
        bpy.ops.object.shade_smooth()
    return obj


def box(name, mat, size, location, bevel=0.0):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.scale = size
    return finish(obj, name, mat, bevel)


def cylinder(name, mat, radius, depth, location, rotation=(0, 0, 0), vertices=16):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    return finish(bpy.context.active_object, name, mat)


def cone(name, mat, r_bottom, r_top, depth, location, smooth=False):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_cone_add(
        vertices=20, radius1=r_bottom, radius2=r_top, depth=depth, location=location
    )
    return finish(bpy.context.active_object, name, mat, smooth=smooth)


def build_car():
    use_collection("Car")
    paint = material("CarPaint", (0.80, 0.08, 0.01), 0.35, 0.2)
    trim = material("Trim", (0.02, 0.02, 0.025), 0.6)
    glass = material("Glass", (0.02, 0.04, 0.07), 0.15, 0.6)
    rubber = material("Rubber", (0.01, 0.01, 0.01), 0.9)
    rim = material("Rim", (0.6, 0.6, 0.62), 0.3, 0.9)
    light = material("Headlight", (1.0, 0.9, 0.6), 0.2, emission=3.0)

    box("Body", paint, (1.1, 2.0, 0.35), (0, 0, 0.42), bevel=0.06)
    box("Cabin", glass, (0.8, 0.9, 0.3), (0, -0.1, 0.75), bevel=0.05)
    box("Bumper", trim, (1.15, 0.15, 0.15), (0, 1.0, 0.3))
    box("Spoiler", paint, (1.1, 0.25, 0.05), (0, -0.9, 0.95))
    for side, x in (("L", -0.4), ("R", 0.4)):
        box(f"Headlight_{side}", light, (0.2, 0.05, 0.08), (x * 0.875, 1.01, 0.45))
        box(f"Strut_{side}", trim, (0.06, 0.06, 0.3), (x, -0.9, 0.78))
    cylinder("Antenna", trim, 0.015, 0.9, (0.4, -0.7, 1.0), vertices=6)

    wheels = (
        ("Wheel_FL", -0.62, 0.65),
        ("Wheel_FR", 0.62, 0.65),
        ("Wheel_RL", -0.62, -0.65),
        ("Wheel_RR", 0.62, -0.65),
    )
    for name, x, y in wheels:
        wheel = cylinder(name, rubber, 0.28, 0.25, (x, y, 0.28), (0, math.pi / 2, 0), 20)
        # An off-centre hub bar so you can see the wheel spin.
        hub = box(f"{name}_Hub", rim, (0.27, 0.08, 0.3), (x, y, 0.28))
        bpy.context.view_layer.update()
        hub.parent = wheel
        hub.matrix_parent_inverse = wheel.matrix_world.inverted()


def build_cone():
    use_collection("Cone")
    orange = material("ConeOrange", (1.0, 0.25, 0.02), 0.5)
    white = material("ConeWhite", (0.9, 0.9, 0.9), 0.4)
    box("ConeBase", orange, (0.5, 0.5, 0.05), (0, 0, 0.025))
    cone("ConeBody", orange, 0.2, 0.03, 0.6, (0, 0, 0.33), smooth=True)
    cone("ConeStripe", white, 0.118, 0.096, 0.08, (0, 0, 0.38), smooth=True)


def build_tires():
    use_collection("Tires")
    rubber = material("TireRubber", (0.015, 0.015, 0.015), 0.95)
    red = material("TireRed", (0.7, 0.02, 0.02), 0.8)
    for i, z in enumerate((0.17, 0.51, 0.85)):
        bpy.ops.object.select_all(action="DESELECT")
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.45, minor_radius=0.17,
            major_segments=24, minor_segments=10, location=(0, 0, z),
        )
        finish(bpy.context.active_object, f"Tire_{i}", red if i == 1 else rubber, smooth=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if os.path.exists(BLEND_PATH) and "--force" not in argv:
        sys.exit(
            f"{BLEND_PATH} already exists. Edit it and run export_gltf.py, "
            "or pass '-- --force' to rebuild it from scratch."
        )
    clear_scene()
    build_car()
    build_cone()
    build_tires()
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    export_collections()


main()
