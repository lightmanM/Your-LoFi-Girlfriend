"""Pose maths on an armature's rest data (no depsgraph updates), plus writing poses to the live rig or to keys.

All vectors and matrices are in armature space. Bones: Y along the bone; on this rig the torso's Z points forward and
the arms' Z is the elbow hinge axis (up in the T pose).
"""
import math
from mathutils import Vector, Matrix, Quaternion

rad = math.radians


class Rig:
    def __init__(self, arm):
        bones = arm.data.bones
        self.names = [b.name for b in bones]
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in bones}
        self.rest = {b.name: b.matrix_local.copy() for b in bones}
        self.rel = {n: (self.rest[p].inverted() @ self.rest[n]) if (p := self.parent[n]) else self.rest[n].copy()
                    for n in self.names}
        self.q = {n: Quaternion() for n in self.names}
        self.loc = {n: Vector() for n in self.names}
        self._m = {}

    # --- state ---
    def load(self, pose):
        """pose: {bone: (w, x, y, z)}; bones not named keep their rotation."""
        for n, v in pose.items():
            self.q[n] = Quaternion(v)
        self._m.clear()

    def snapshot(self, names=None):
        return {n: self.q[n].copy() for n in (names or self.names)}

    def set(self, n, q):
        self.q[n] = q
        self._m.clear()

    def m(self, n):
        c = self._m.get(n)
        if c is None:
            p = self.parent[n]
            c = (self.m(p) @ self.rel[n] if p else self.rel[n]) @ (Matrix.Translation(self.loc[n]) @ self.q[n].to_matrix().to_4x4())
            self._m[n] = c
        return c

    def head(self, n):
        return self.m(n).translation.copy()

    def axis(self, n, i):
        return self.m(n).col[i].to_3d().normalized()

    def frame(self, n):
        """Parent-space frame the bone's own rotation is applied in."""
        p = self.parent[n]
        return (self.m(p) @ self.rel[n] if p else self.rel[n]).to_3x3()

    # --- posing ---
    def set_rot(self, n, r3):
        self.set(n, (self.frame(n).inverted() @ r3).to_quaternion())

    def turn(self, n, axis, degrees):
        if degrees:
            self.set_rot(n, Quaternion(Vector(axis), rad(degrees)).to_matrix() @ self.m(n).to_3x3())

    def orient(self, n, direction, guide, guide_axis='Z'):
        y = Vector(direction).normalized()
        g = Vector(guide)
        g = (g - y * g.dot(y)).normalized()
        if guide_axis == 'Z':
            z = g; x = y.cross(z).normalized(); z = x.cross(y)
        else:
            x = g; z = x.cross(y).normalized(); x = y.cross(z)
        self.set_rot(n, Matrix((x, y, z)).transposed())

    def length(self, a, b):
        return (self.rest[b].translation - self.rest[a].translation).length

    def limb(self, upper, lower, end, target, bend, side, reach=0.999):
        """Two-bone reach. `bend` is the direction the elbow leaves the shoulder-wrist line. Returns the miss."""
        h = self.head(upper)
        l1, l2 = self.length(upper, lower), self.length(lower, end)
        delta = Vector(target) - h
        d = max(abs(l1 - l2) + 1e-4, min(delta.length, (l1 + l2) * reach))
        ax = delta.normalized()
        b = Vector(bend); b = (b - ax * b.dot(ax)).normalized()
        along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
        elbow = h + ax * along + b * math.sqrt(max(0.0, l1 * l1 - along * along))
        normal = b.cross(ax) * (-side)          # hinge axis; defined even with a straight elbow
        goal = h + ax * d
        self.orient(upper, elbow - h, normal)
        self.aim(upper, lower, elbow)
        self.orient(lower, goal - self.head(lower), normal)
        self.aim(lower, end, goal)
        return (self.head(end) - Vector(target)).length

    def aim(self, n, child, point):
        """Small correction so the child's joint lands on `point` (joints sit a little off the bone's axis)."""
        h = self.head(n)
        q = (self.head(child) - h).rotation_difference(Vector(point) - h)
        self.set_rot(n, q.to_matrix() @ self.m(n).to_3x3())


def write_pose(arm, rig, names=None):
    """Put the rig's rotations on the live armature (for looking at a pose; nothing is keyed)."""
    for n in (names or rig.names):
        p = arm.pose.bones[n]
        p.rotation_mode = 'QUATERNION'
        p.rotation_quaternion = rig.q[n]
        p.location = rig.loc[n]


def read_pose(arm):
    return {p.name: tuple(p.matrix_basis.to_quaternion()) for p in arm.pose.bones}
