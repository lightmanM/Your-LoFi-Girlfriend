"""Timing curves. A Track is a start value plus moves; each move adds its change over its own time window with its own
ease, so moves whose windows overlap blend into one curved, continuous motion (no stop at the in-between pose)."""
import math


def smooth(x):
    return 0.0 if x <= 0 else 1.0 if x >= 1 else x * x * (3 - 2 * x)


def smoother(x):
    return 0.0 if x <= 0 else 1.0 if x >= 1 else x * x * x * (x * (6 * x - 15) + 10)


def _out(x):
    return 0.0 if x <= 0 else 1.0 if x >= 1 else 1 - (1 - x) ** 3


def _in(x):
    return 0.0 if x <= 0 else 1.0 if x >= 1 else x ** 2.4


def _back(x, c=1.6):
    """A quick (but not instant) start that slows, passes the goal a little and settles."""
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    x = x ** 1.7
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def _down(x):
    """Slow at first, faster, then a soft arrival."""
    return 0.0 if x <= 0 else 1.0 if x >= 1 else smooth(x ** 1.7)


EASE = {'io': smoother, 'soft': smooth, 'out': _out, 'in': _in, 'back': _back, 'down': _down}


class Track:
    def __init__(self, v0):
        self.v0 = v0
        self.moves = []

    def to(self, v, a, b, ease='io'):
        self.moves.append((v, a, b, EASE[ease]))
        return self

    def __call__(self, t):
        out = prev = self.v0
        for v, a, b, e in self.moves:
            k = e((t - a) / (b - a))
            if k:
                out = out + (v - prev) * k
            prev = v
        return out


def pulse(t, a, b, c, d):
    """0 before a, 1 between b and c, 0 after d."""
    return smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)))


def blink(t, at, close=0.07, hold=0.03, open_=0.14):
    return pulse(t, at, at + close, at + close + hold, at + close + hold + open_)
