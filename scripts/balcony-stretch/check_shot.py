"""Checks on the shot itself, run inside Blender on the saved study file (needs the local character and scene):

  blender -b assets/characters/marycia/balcony-study/balcony-stretch-anim-2026-11-10.blend -P scripts/balcony-stretch/check_shot.py

Exits 1 if a check fails.
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
import rig as R
import stretch as ST
import apply
import overlap

HAND_IN_BOOK = 2.0        # mm a resting or passing hand may press into the book
LIMITS = dict(hand_speed=1.3, hand_accel=8.0, book_speed=0.7, head_spin=110.0, head_accel=600.0)   # m/s, m/s2, deg/s, deg/s2


def main():
    arm, book, face = apply.objects()
    fails = []
    def check(name, ok, detail=''):
        print(('ok   ' if ok else 'FAIL ') + name + (': ' + str(detail) if detail != '' else ''))
        if not ok: fails.append(name)

    # the solver agrees with Blender's own pose evaluation
    rg = R.Rig(arm)
    rg.load(R.read_pose(arm))
    bpy.context.view_layer.update()
    err = max((rg.m(p.name).translation - p.matrix.translation).length for p in arm.pose.bones)
    check('solver matches Blender pose matrices', err < 1e-4, f'{err:.2e}')

    shot = ST.Shot(arm, book, face)
    # she starts and ends in the approved reading pose (eyes and breathing aside)
    for label, t in (('start', 0.0), ('end', ST.LENGTH - 1 / ST.FPS)):
        out = shot.pose(t)
        worst = max((math.degrees(shot.rg.q[n].rotation_difference(shot.base_q[n]).angle), n) for n in shot.rg.names if not n.startswith('Eye'))
        check(f'{label}: body within 2 degrees of the reading pose', worst[0] < 2.0, worst)
        check(f'{label}: book where she reads it', (out['book'][0] - shot.read_c).length < 0.002)

    rep = apply.analyse()
    rep.pop('table')
    print(json.dumps(rep))
    for sd in 'LR':
        check(f'hand {sd} stays on its grip while carrying', rep[f'grip_slip_mm_{sd}'] < 1.0, rep[f'grip_slip_mm_{sd}'])
        check(f'hand {sd} speed', rep['wr' + sd]['peak_m_s'] < LIMITS['hand_speed'], rep['wr' + sd]['peak_m_s'])
        check(f'hand {sd} has no jolt', rep['wr' + sd]['peak_accel_m_s2'] < LIMITS['hand_accel'], rep['wr' + sd]['peak_accel_m_s2'])
        check(f'elbow {sd} never locks straight', rep[f'straightest_elbow_deg_{sd}'] > 10.0, rep[f'straightest_elbow_deg_{sd}'])
        check(f'shoulder {sd} rises with the arm, not to the ear', 3.0 < rep[f'shoulder_rise_cm_{sd}'] < 8.0, rep[f'shoulder_rise_cm_{sd}'])
        check(f'hand {sd} clear of her head', rep[f'hand_to_head_min_cm_{sd}'][0] > 25.0, rep[f'hand_to_head_min_cm_{sd}'])
    check('book speed', rep['book']['peak_m_s'] < LIMITS['book_speed'], rep['book']['peak_m_s'])
    check('head speed', rep['head']['peak_deg_s'] < LIMITS['head_spin'], rep['head']['peak_deg_s'])
    check('head has no jolt', rep['head']['peak_accel_deg_s2'] < LIMITS['head_accel'], rep['head']['peak_accel_deg_s2'])

    # the book never dips below where it lies on her lap, and lies flat while her hands are away
    low = min((shot.book(i / ST.FPS)[0] - shot.lap_c).dot(shot.lap_b.col[2]) for i in range(int(ST.LENGTH * ST.FPS)))
    check('book never below its place on her lap', low > -1e-4, f'{low * 1000:.2f} mm')
    c, b3 = shot.book(7.0)
    check('book flat on her lap during the stretch', (c - shot.lap_c).length < 1e-6 and b3.col[2].angle(shot.lap_b.col[2]) < 1e-4)
    # both arms are up at the top of the stretch
    shot.pose(7.4)
    for sd in 'LR':
        up = shot.rg.axis('Upper_arm.' + sd, 1).dot(shot.rg.axis('Chest', 1))
        check(f"arm {sd} up at the top", up > 0.75, round(up, 2))

    # her hands go round the book, not through it (measured on the deformed skin against the book's solid)
    bpy.context.window.scene = bpy.data.scenes[apply.SCENE]
    rows = overlap.scan([i / ST.FPS for i in range(int(ST.LENGTH * ST.FPS))])
    held = overlap.worst(rows[:1])                 # the approved reading grip presses this far into the page edge
    check('hands never deeper in the book than the reading grip', overlap.worst(rows) < held + 0.5, f'{overlap.worst(rows)} mm, grip {held} mm')
    away = [r for r in rows if ST.LET_GO[0] + 0.4 < r['t'] < ST.GRIP[1] - 0.4]
    check('hands only touch the book once they have let go', overlap.worst(away) < HAND_IN_BOOK, f'{overlap.worst(away)} mm')
    print('FAILED: ' + ', '.join(fails) if fails else 'all checks passed')
    sys.exit(1 if fails else 0)


main()
