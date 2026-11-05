import unittest
from extract_source_motions import evaluate_curve
class Curves(unittest.TestCase):
 def test_hermite_preserves_tangents(self):
  keys=[dict(time=0,value=0,outSlope=0),dict(time=1,value=1,inSlope=0)]
  self.assertAlmostEqual(evaluate_curve(keys,.25),.15625)
 def test_weighted_bezier_time_is_solved(self):
  # Control points (0,0),(.1,1),(.7,1),(1,0). At u=.5, x=.425 and y=.75.
  keys=[dict(time=0,value=0,outSlope=10,outWeight=.1,weightedMode=2),dict(time=1,value=0,inSlope=-10/3,inWeight=.3,weightedMode=1)]
  self.assertAlmostEqual(evaluate_curve(keys,.425),.75,places=6)
 def test_static_and_step(self):
  self.assertEqual(evaluate_curve([dict(time=0,value=.42)],999),.42)
  self.assertEqual(evaluate_curve([dict(time=0,value=2,outSlope=float('inf')),dict(time=1,value=3)],.9),2)
if __name__=='__main__':unittest.main()
