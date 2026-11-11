"""Timing curves (run: python3 -m unittest discover -s scripts/balcony-stretch)."""
import unittest
from tracks import Track, EASE, pulse, blink, smooth


class Eases(unittest.TestCase):
    def test_every_ease_starts_at_0_and_ends_at_1(self):
        for name, e in EASE.items():
            self.assertEqual(e(-0.5), 0.0, name)
            self.assertEqual(e(0.0), 0.0, name)
            self.assertAlmostEqual(e(1.0), 1.0, msg=name)
            self.assertEqual(e(1.5), 1.0, name)

    def test_no_ease_starts_with_a_jolt(self):
        # the first 2 % of the time covers under 2 % of the way: nothing leaves at full speed
        for name, e in EASE.items():
            if name == 'out': continue                  # 'out' is the one ease meant to leave at speed
            self.assertLess(e(0.02), 0.02, name)

    def test_back_passes_the_goal_then_settles(self):
        peak = max(EASE['back'](i / 200) for i in range(201))
        self.assertGreater(peak, 1.02)
        self.assertLess(peak, 1.2)

    def test_down_is_slow_first(self):
        self.assertLess(EASE['down'](0.3), 0.1)
        self.assertGreater(EASE['down'](0.8), 0.75)


class Tracks(unittest.TestCase):
    def test_holds_before_between_and_after_moves(self):
        tr = Track(1.0).to(3.0, 2.0, 4.0).to(0.0, 6.0, 7.0)
        self.assertEqual(tr(0.0), 1.0)
        self.assertAlmostEqual(tr(4.0), 3.0)
        self.assertAlmostEqual(tr(5.0), 3.0)
        self.assertAlmostEqual(tr(9.0), 0.0)

    def test_overlapping_moves_blend_without_a_stop(self):
        tr = Track(0.0).to(1.0, 0.0, 1.0).to(2.0, 0.6, 1.6)
        steps = [tr((i + 1) / 100) - tr(i / 100) for i in range(160)]
        self.assertTrue(all(s >= 0 for s in steps))
        self.assertGreater(min(steps[20:140]), 0.002)       # still moving through the first move's end
        self.assertAlmostEqual(tr(1.6), 2.0)

    def test_works_on_vectors(self):
        class V(tuple):
            def __add__(self, o): return V(a + b for a, b in zip(self, o))
            def __sub__(self, o): return V(a - b for a, b in zip(self, o))
            def __mul__(self, k): return V(a * k for a in self)
        tr = Track(V((0.0, 0.0))).to(V((2.0, 4.0)), 0.0, 1.0, 'soft')
        self.assertEqual(tr(0.5), V((1.0, 2.0)))


class Pulses(unittest.TestCase):
    def test_pulse_shape(self):
        self.assertEqual(pulse(0.0, 1, 2, 3, 4), 0.0)
        self.assertEqual(pulse(2.5, 1, 2, 3, 4), 1.0)
        self.assertEqual(pulse(5.0, 1, 2, 3, 4), 0.0)
        self.assertAlmostEqual(pulse(1.5, 1, 2, 3, 4), smooth(0.5))

    def test_blink_closes_and_opens_within_a_quarter_second(self):
        self.assertEqual(blink(0.99, 1.0), 0.0)
        self.assertAlmostEqual(blink(1.08, 1.0), 1.0)
        self.assertEqual(blink(1.25, 1.0), 0.0)


if __name__ == '__main__':
    unittest.main()
