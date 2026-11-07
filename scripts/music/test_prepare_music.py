"""Unit tests for the pure helpers in prepare_music.py (run: python3 -m unittest scripts/music/test_prepare_music.py)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import prepare_music as pm  # noqa: E402


class SlugTest(unittest.TestCase):
    def test_lowercases_and_dashes(self):
        self.assertEqual(pm.slugify("Lao Ban", "Fine dining BGM"), "lao-ban-fine-dining-bgm")

    def test_drops_punctuation(self):
        self.assertEqual(pm.slugify("VibeDepot", "lo-fi"), "vibedepot-lo-fi")


class TitleTest(unittest.TestCase):
    def test_strips_track_number_and_artist(self):
        self.assertEqual(pm.title_from_member("02 VibeDepot - calm.mp3", "VibeDepot"), "calm")

    def test_keeps_names_without_number(self):
        self.assertEqual(pm.title_from_member("VibeDepot - easy hiphop.mp3", "VibeDepot"), "easy hiphop")


class GainTest(unittest.TestCase):
    def test_raises_quiet_track_to_target(self):
        self.assertAlmostEqual(pm.gain_db(-20.0, -6.0), 4.0)

    def test_lowers_loud_track(self):
        self.assertAlmostEqual(pm.gain_db(-10.0, -0.5), -6.0)

    def test_never_pushes_peaks_past_ceiling(self):
        self.assertAlmostEqual(pm.gain_db(-22.0, -3.0), 2.0)


class ManifestTest(unittest.TestCase):
    def test_rejects_entry_without_licence(self):
        with self.assertRaises(ValueError):
            pm.validate_source({"artist": "A", "file": "a.mp3", "include": True})

    def test_accepts_complete_entry(self):
        pm.validate_source({
            "artist": "A", "file": "a.mp3", "include": True,
            "license": {"name": "CC0 1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/"},
            "source_url": "https://example.org",
        })


if __name__ == "__main__":
    unittest.main()
