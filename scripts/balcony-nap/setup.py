"""Build the nap study scene in the live Blender, from the stretch study's scene (run once).

Copies 'Balcony • Stretch anim (Claude)' (the page's camera, the toon balcony) with its own copy of her and the book,
in the reading pose, and stores on the armature what nap.py starts from: the reading pose, her hips' place and the
book's place in her left hand.
"""
import json
import bpy
import rig as R

SRC, NEW, P = 'Balcony • Stretch anim (Claude)', 'Balcony • Nap walk (Claude)', 'Nap walk • '


def build():
    src = bpy.data.scenes[SRC]
    src.frame_set(1)
    if NEW in bpy.data.scenes:
        raise RuntimeError(NEW + ' already exists')
    s = src.copy()
    s.name, s.use_fake_user = NEW, True
    old = s.collection.children['Stretch anim • character (Claude)']
    s.collection.children.unlink(old)
    col = bpy.data.collections.new(P + 'character (Claude)')
    s.collection.children.link(col)
    m = {}
    for o in old.all_objects:
        c = o.copy()
        c.name = o.name.replace('Stretch anim • ', P)
        if o.type == 'MESH' and o.data.shape_keys:
            c.data = o.data.copy()
            if c.data.shape_keys.animation_data:
                c.data.shape_keys.animation_data_clear()
        if c.animation_data:
            c.animation_data_clear()
        col.objects.link(c)
        m[o] = c
    for o, c in m.items():
        if o.parent in m:
            c.parent = m[o.parent]
            c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
        for md in c.modifiers:
            if md.type == 'ARMATURE' and md.object in m:
                md.object = m[md.object]
    arm_o = bpy.data.objects['Stretch anim • armature']
    arm = m[arm_o]
    for pb in arm_o.pose.bones:
        q = arm.pose.bones[pb.name]
        q.rotation_mode = 'QUATERNION'
        q.rotation_quaternion = pb.matrix_basis.to_quaternion()
        q.location = pb.location.copy()
    # the toon compositor reads the scene it was built for: give this scene its own copy
    tree = s.compositing_node_group.copy()
    tree.name = P + 'compositor'
    s.compositing_node_group = tree
    for n in tree.nodes:
        if getattr(n, 'scene', None) is not None:
            n.scene = s
    bpy.context.window.scene = s
    bpy.context.view_layer.update()
    arm['nap_base_pose'] = json.dumps(R.read_pose(arm))
    arm['nap_base_hips'] = list(arm.pose.bones['Hips'].location)
    hand = arm.matrix_world @ arm.pose.bones['Hand.L'].matrix
    grip = hand.inverted() @ bpy.data.objects['Stretch anim • book'].matrix_world
    arm['nap_book_grip'] = json.dumps([list(r) for r in grip])
    return s
