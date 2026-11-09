"""Unit tests for the pure helpers in generate_lines.py (run: python3 -m unittest scripts/voice/test_generate_lines.py)."""
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import generate_lines as gl  # noqa: E402


FPS = 24000 / 256  # the engine's frames per second


def frames(seconds, speed=1.0):
    """A length as the engine renders it: whole frames, halves rounded up."""
    return math.floor(seconds * FPS / speed + 0.5) / FPS


def mora(text, consonant, c_len, vowel, v_len):
    return {"text": text, "consonant": consonant, "consonant_length": c_len, "vowel": vowel, "vowel_length": v_len, "pitch": 5.5}


QUERY = {
    "speedScale": 1.0, "prePhonemeLength": 0.1, "postPhonemeLength": 0.1, "pauseLength": None, "pauseLengthScale": 1.0,
    "accent_phrases": [
        {"moras": [mora("ア", None, None, "a", 0.1)], "pause_mora": mora("、", None, None, "pau", 0.3)},
        {"moras": [mora("カ", "k", 0.05, "a", 0.1), mora("ミ", "m", 0.06, "i", 0.08)], "pause_mora": None},
    ],
}


class StyleTest(unittest.TestCase):
    SPEAKERS = [
        {"name": "四国めたん", "styles": [{"name": "ノーマル", "id": 2}]},
        {"name": "冥鳴ひまり", "styles": [{"name": "ノーマル", "id": 14}]},
    ]

    def test_finds_style_id_by_names(self):
        self.assertEqual(gl.find_style_id(self.SPEAKERS, "冥鳴ひまり", "ノーマル"), 14)

    def test_missing_voice_names_what_is_installed(self):
        with self.assertRaises(SystemExit) as e:
            gl.find_style_id(self.SPEAKERS, "冥鳴ひまり", "ささやき")
        self.assertIn("冥鳴ひまり", str(e.exception))


class TimelineTest(unittest.TestCase):
    def test_moras_follow_each_other_after_the_lead_in(self):
        t = gl.timeline(QUERY)
        self.assertEqual([m["text"] for m in t["moras"]], ["ア", "、", "カ", "ミ"])
        self.assertAlmostEqual(t["moras"][0]["start"], frames(0.1), places=3)
        for a, b in zip(t["moras"], t["moras"][1:]):
            self.assertAlmostEqual(a["end"], b["start"])

    def test_consonant_comes_before_the_vowel(self):
        ka = gl.timeline(QUERY)["moras"][2]
        self.assertAlmostEqual(ka["vowelStart"] - ka["start"], frames(0.05), places=3)
        self.assertEqual((ka["consonant"], ka["vowel"]), ("k", "a"))

    def test_pause_is_marked_and_lengthened_by_its_scale(self):
        q = {**QUERY, "pauseLengthScale": 2.0}
        pau = gl.timeline(q)["moras"][1]
        self.assertEqual(pau["vowel"], "pau")
        self.assertAlmostEqual(pau["end"] - pau["start"], frames(0.6), places=3)

    def test_duration_includes_lead_in_and_tail(self):
        parts = (0.1, 0.1, 0.3, 0.05, 0.1, 0.06, 0.08, 0.1)
        self.assertAlmostEqual(gl.timeline(QUERY)["duration"], sum(frames(x) for x in parts), places=3)

    def test_speed_scale_shortens_everything(self):
        slow, fast = gl.timeline(QUERY), gl.timeline({**QUERY, "speedScale": 2.0})
        self.assertLess(fast["duration"], slow["duration"] * 0.53)
        self.assertGreater(fast["duration"], slow["duration"] * 0.47)
        self.assertAlmostEqual(fast["moras"][0]["end"] - fast["moras"][0]["start"], frames(0.1, 2.0), delta=0.001)

    def test_each_sound_lasts_whole_engine_frames(self):
        for m in gl.timeline({**QUERY, "speedScale": 0.94})["moras"]:
            for a, b in (("start", "vowelStart"), ("vowelStart", "end")):
                n = (m[b] - m[a]) * FPS
                self.assertAlmostEqual(n, round(n), delta=0.1)

    def test_rounding_does_not_add_up_to_drift(self):
        # ten sounds of 1.45 frames each: the engine renders 1 frame each (10 frames), not 14.5
        q = {**QUERY, "prePhonemeLength": 0.0, "postPhonemeLength": 0.0,
             "accent_phrases": [{"moras": [mora("ア", None, None, "a", 1.45 / FPS)] * 10, "pause_mora": None}]}
        self.assertAlmostEqual(gl.timeline(q)["duration"], 10 / FPS, places=3)

    def test_half_a_frame_rounds_up(self):
        q = {**QUERY, "prePhonemeLength": 0.0, "postPhonemeLength": 0.0,
             "accent_phrases": [{"moras": [mora("ア", None, None, "a", 1.5 / FPS)], "pause_mora": None}]}
        self.assertAlmostEqual(gl.timeline(q)["duration"], 2 / FPS, places=3)

    def test_times_are_rounded_to_milliseconds(self):
        for m in gl.timeline({**QUERY, "speedScale": 0.94})["moras"]:
            for k in ("start", "vowelStart", "end"):
                self.assertEqual(m[k], round(m[k], 3))


class EnvelopeTest(unittest.TestCase):
    def test_silence_then_tone(self):
        rate, fps = 1000, 10
        samples = [0] * 500 + [8000 if i % 2 else -8000 for i in range(500)]
        env = gl.envelope(samples, rate, fps)
        self.assertEqual(len(env), 10)
        self.assertEqual(env[:5], [0] * 5)
        self.assertEqual(env[5:], [100] * 5)

    def test_quieter_part_scales_below_the_peak(self):
        rate, fps = 1000, 10
        loud = [8000 if i % 2 else -8000 for i in range(500)]
        quiet = [2000 if i % 2 else -2000 for i in range(500)]
        env = gl.envelope(loud + quiet, rate, fps)
        self.assertTrue(0 < env[-1] < env[0] == 100)

    def test_all_silent_stays_zero(self):
        self.assertEqual(gl.envelope([0] * 300, 1000, 10), [0, 0, 0])


class CreditsTest(unittest.TestCase):
    def test_names_the_required_credit_and_terms(self):
        voice = {"credit": "VOICEVOX:冥鳴ひまり", "terms": "https://example.org/terms"}
        text = gl.credits(voice, [{"id": "okaeri", "text": "おかえりなさい"}])
        self.assertIn("VOICEVOX:冥鳴ひまり", text)
        self.assertIn("https://example.org/terms", text)
        self.assertIn("おかえりなさい", text)


if __name__ == "__main__":
    unittest.main()


class PreviousLinesTest(unittest.TestCase):
    def test_full_run_starts_fresh(self):
        self.assertEqual(gl.previous_lines(Path("/nonexistent/lines.json"), None), {})

    def test_only_keeps_the_other_lines(self):
        with tempfile.TemporaryDirectory() as d:
            index = Path(d) / "lines.json"
            index.write_text(json.dumps({"lines": [{"id": "a"}, {"id": "b"}]}))
            self.assertEqual(sorted(gl.previous_lines(index, "a")), ["a", "b"])

    def test_only_without_an_index_refuses_rather_than_dropping_the_other_lines(self):
        with self.assertRaises(SystemExit) as e:
            gl.previous_lines(Path("/nonexistent/lines.json"), "a")
        self.assertIn("--only", str(e.exception))



def pau(start, end):
    return {"text": "、", "consonant": None, "vowel": "pau", "start": start, "vowelStart": start, "end": end}


def spoken(text, start, end):
    return {"text": text, "consonant": None, "vowel": "a", "start": start, "vowelStart": start, "end": end}


class LineKindTest(unittest.TestCase):
    def test_check_line_accepts_greeting_and_talk(self):
        gl.check_line({"id": "g", "kind": "greeting"})
        gl.check_line({"id": "t", "kind": "talk", "to": "self", "about": "book", "mood": "dark"})

    def test_check_line_rejects_unknown_values(self):
        for bad, field in [({"id": "x", "kind": "song"}, "kind"),
                           ({"id": "x", "kind": "talk", "to": "them", "about": "life", "mood": "light"}, "to"),
                           ({"id": "x", "kind": "talk", "to": "you", "about": "work", "mood": "light"}, "about"),
                           ({"id": "x", "kind": "talk", "to": "you", "about": "life", "mood": "grim"}, "mood")]:
            with self.assertRaises(SystemExit) as e:
                gl.check_line(bad)
            self.assertIn("x", str(e.exception))
            self.assertIn(field, str(e.exception))


class SubtitlePartsTest(unittest.TestCase):
    def test_split_subtitle_joins_and_returns_parts(self):
        whole, parts = gl.split_subtitle({"ja": ["あ。", "い"], "en": ["A.", "B."]})
        self.assertEqual(whole, {"ja": "あ。い", "en": "A. B."})
        self.assertEqual(parts, [{"ja": "あ。", "en": "A."}, {"ja": "い", "en": "B."}])
        self.assertEqual(gl.split_subtitle({"ja": "あ", "en": "A."}), ({"ja": "あ", "en": "A."}, None))

    def test_split_subtitle_rejects_mismatched_parts(self):
        with self.assertRaises(SystemExit):
            gl.split_subtitle({"ja": ["あ。", "い"], "en": ["A. B."]})

    def test_part_starts(self):
        moras = [spoken("ア", 0.05, 0.2), pau(0.2, 0.5), spoken("イ", 0.5, 0.6), spoken("ウ", 0.6, 0.7)]
        self.assertEqual(gl.spoken_count(moras), 3)
        self.assertEqual(gl.part_starts(moras, [1, 2]), [0.05, 0.5])

    def test_part_starts_rejects_count_mismatch(self):
        moras = [spoken("ア", 0.05, 0.2), pau(0.2, 0.5), spoken("イ", 0.5, 0.6)]
        with self.assertRaises(SystemExit):
            gl.part_starts(moras, [1, 2])


class SentencePauseTest(unittest.TestCase):
    # "ア、イウ。エ": a 、 pause after ア (inside the first sentence), then the sentence break after イウ
    Q = {**QUERY, "accent_phrases": [
        {"moras": [mora("ア", None, None, "a", 0.1)], "pause_mora": mora("、", None, None, "pau", 0.3)},
        {"moras": [mora("イ", None, None, "i", 0.1), mora("ウ", None, None, "u", 0.1)], "pause_mora": mora("、", None, None, "pau", 0.3)},
        {"moras": [mora("エ", None, None, "e", 0.1)], "pause_mora": None},
    ]}

    def test_only_the_pause_between_sentences_is_lengthened(self):
        q = gl.lengthen_sentence_pauses(self.Q, [3, 1], 0.7)
        self.assertEqual(q["accent_phrases"][0]["pause_mora"]["vowel_length"], 0.3)
        self.assertEqual(q["accent_phrases"][1]["pause_mora"]["vowel_length"], 0.7)

    def test_the_query_given_is_not_changed(self):
        gl.lengthen_sentence_pauses(self.Q, [3, 1], 0.7)
        self.assertEqual(self.Q["accent_phrases"][1]["pause_mora"]["vowel_length"], 0.3)

    def test_a_single_sentence_is_left_alone(self):
        self.assertEqual(gl.lengthen_sentence_pauses(self.Q, [4], 0.7), self.Q)

    def test_a_longer_pause_already_there_is_kept(self):
        q = gl.lengthen_sentence_pauses(self.Q, [3, 1], 0.2)
        self.assertEqual(q["accent_phrases"][1]["pause_mora"]["vowel_length"], 0.3)

    def test_sentences_that_do_not_match_the_line_are_refused(self):
        with self.assertRaises(SystemExit):
            gl.lengthen_sentence_pauses(self.Q, [2, 2], 0.7)

    def test_sentences_split_at_the_full_stop(self):
        self.assertEqual(gl.sentences("あ、い。う。"), ["あ、い。", "う。"])
        self.assertEqual(gl.sentences("あい"), ["あい"])
