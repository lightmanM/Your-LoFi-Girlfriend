# Small talk while she reads: design (2026-11-08)

While the visitor has the page open, the girl on the balcony now and then says something: sometimes to the visitor,
sometimes to herself. It builds on the greeting (branch `claude/character-dialogue-expressions-f13bd3`): her
VOICEVOX voice (冥鳴ひまり), lip sync, subtitles, and looking straight at the camera.

Marks: **(theirs)** was decided by the project owner in conversation; **(my call)** was decided by the designer and can
be changed; anything unmarked follows from those or from the existing code.

## Intent

Company while you work or study. She is busy with her own quiet afternoon (reading, her plants, her thoughts), and once
in a while she shares a little of it, then goes back to her book. She never asks for an answer and never interrupts for
long. Success: someone with the page open for an hour notices her speak a handful of times and it feels like someone is
there with them, not like a notification.

## Who she is (theirs, in outline; the details are my call)

Someone who takes life slowly and has deep, philosophical thoughts **(theirs)**. She notices small everyday things (the
basil sprouting, sparrows on the railing, the colour of the sky) and they open into quiet thoughts. The book she is
reading is a philosophy book **(theirs)**: she retells its ideas in her own casual words and ties them to her small
life; she does not lecture or quote. Some of her thoughts are dark (endings, being forgotten, futility); sometimes they
turn back toward calm at the end, sometimes not **(theirs)**. Her tone stays calm throughout.

The book is a collection of classic thinkers, all long out of copyright (my call): Heraclitus, Zhuangzi, Seneca,
Epicurus, Marcus Aurelius, Pascal, Thoreau, and the Sisyphus myth. She paraphrases ideas, never quotes a translation.

## Goals

- She speaks at random, about once every 1 to 2 minutes **(theirs; first 5 to 10, changed to 1 to 2 on 2026-11-09)**.
- Two kinds of talk: **to you** (she looks up at the camera) and **to herself** (she stays with her book).
- Content: her small daily life, her passing thoughts, the philosophy book, and some dark lines **(theirs)**.
- Every line is in her existing voice, lip-synced, with Japanese and English subtitles, like the greeting.

## Non-goals

- No conversation: the visitor cannot reply; no speech recognition, no text box.
- No runtime generation (no language model, no TTS in the browser): every line is written, generated with VOICEVOX
  ahead of time and shipped as audio, like the greetings.
- No stretch-break sounds (tried and dropped: VOICEVOX makes non-word sounds sound electronic).
- No awareness of time of day, the music playing, or how long the visitor has stayed.

## Anti-goals (it fails if...)

- Lines bring in things outside her quiet world that the owner rejected: her job, strangers, coworkers, or reactions to
  a story's plot ("wait, he's the culprit?", "I like this line"). These were tried and disliked **(theirs)**.
- She lectures or sounds preachy.
- Anything sounds like self-harm, wanting to disappear, or "the world would be better without me". People may keep the
  page open for hours, sometimes on low days (my call, a hard rule for any future lines too).
- She talks too often, too loudly over the music, over another of her own motions, or repeats lines soon.

## Behaviour

### When (timing theirs, the rest my call)

- After the greeting ends (or, without the greeting, after the page starts), the next line is due after a random wait
  of 1 to 2 minutes; after each line, a new random wait of 1 to 2 minutes.
- She never talks over something else: the greeting, a stretch break, a page turn, or one of her random glances up. If
  a line comes due during one of those, she waits until it is over, plus a short breath (about 3 s).
- If the tab is hidden when a line comes due (`document.hidden`), she skips it and waits a new 1 to 2 minutes.
- If the browser has not allowed sound yet (no click or key press on the page so far), she skips it the same way: no
  silent talking with subtitles only.
- If the music is paused (Space or the pause control), she skips it the same way: pausing reads as "I want quiet",
  e.g. a call (my call). Muting is different: see Sound.

### Talking to you

- She looks at the camera: by default as in the greeting (`reader.attend`, the head aim and the 10° tilt cap), looking
  up, speaking, keeping her look for about a second, then going back to her book; or one of the other to-you motions
  under Motion variety (a glance up mid-line, or an eyes-only look for short lines).
- Light lines: a soft smile, as in the greeting, a little weaker (my call). Dark lines: no smile; a calm, relaxed face.
- The small nod at the end of the line: light lines only (my call).

### Talking to herself

- She does not look at you. Her motion is one of the to-herself motions under Motion variety (eyes on the page, a
  glance aside toward the daybed, thinking up, a small tilt, or eyes half-closing on dark lines); the reading eye
  movement pauses while she speaks, then reading continues (my call).
- Softer and a little slower voice: generated at speed 0.82 and volume 0.75, against 0.85 and 1.0 for lines to you
  (my call).
- Her subtitle is a murmur: smaller and dimmer than the to-you subtitle, same place (my call).
- No smile; a relaxed face.

### Motion variety (theirs in direction; the details are my call)

Each line picks one motion at random from those that suit it, never the same motion twice in a row, so her talk does
not look the same each time **(theirs)**. All of them are subtle: apart from the full look at you, her head turns no
more than about 15°, each motion eases in and out over about a second, and her hands and the book stay where they are.

To herself (these replace the single "stays on the book" behaviour above):

| motion | what she does | suits |
| --- | --- | --- |
| half-aloud | eyes stay on the page and stop moving along the line, as if reading the line half-aloud | book lines mostly |
| glance aside | head turns a little to look aside toward the daybed on the left of the picture, eyes resting on it or past it; then back to the book. Not out past the railing: that turn is too large **(theirs)** | any |
| thinking up | head lifts slightly, eyes go up and away into space, as in her random glances up | thoughts mostly |
| small tilt | head tilts a little to one side while her eyes stay on the book, mulling it over | any |
| eyes half-close | eyes half-close softly for part of the line | dark lines only |

To you:

| motion | what she does | suits |
| --- | --- | --- |
| full look | as described above: looks up at you, speaks, lingers, back to the book | any |
| glance mid-line | starts saying it toward her book and looks up at you partway through (at the sentence break if there is one, otherwise about a third in), as if the thought turned into something she wanted to tell you | lines of about 4 s or more |
| eyes only | a small look for a short line: her eyes come up to you and her head barely moves | lines under about 4 s; **not picked (built 2026-11-09)**: from this camera her eyes read as narrowed, not meeting yours; still available by name for checks |

Note for "eyes only": this model's eyes turn only about a tenth of the angle they are asked to (its look-at range
maps are tiny; see `head-aim.js`), so an eyes-only look cannot reach the camera as the model is set up. The builder
chooses how: widen the eye range while she looks, let the head take part of the turn, or both. It must still read as
"she looked at me".

### Mix and order (my call)

- Lines to you and to herself are about half and half; dark lines are 7 of 32 (a little over 1 in 5).
- She works through every line before any repeats: a shuffled order, remembered in the browser (`localStorage`) so a
  returning visitor hears lines they have not heard first. Storage blocked: a fresh shuffle each visit.
- Never two dark lines in a row (also across the end of one round and the start of the next).

### Sound (my call)

- The music dips while she speaks (about −6 dB, eased in and out over about 0.4 s), for the greeting too.
- Muting (the M key or the mute control) mutes her voice as well; subtitles still show and she still moves her mouth.
  Unmuting brings both back. Today her voice ignores mute; this fixes that for the greeting too.
- Her voice follows the music's volume control: at the default volume (0.7) she plays at her full level, and she scales
  with it from there (half the music volume, half her level; capped at her full level when the music is turned up), so
  someone who turned the music down to study does not get a voice much louder than the music (my call). At volume 0
  she is silent, like mute. The greeting follows the same rule.

### Subtitles

- Same place and style as the greeting for lines to you; murmur style for lines to herself.
- Lines of about 6 s or longer that contain a `。` are shown in two parts, each part shown while it is spoken (my
  call); shorter lines, and lines with no `。`, show whole. The greetings are all under 4 s and keep showing whole, so
  their existing tests stand.
- The split is written by hand in the manifest (the Japanese and English parts of each split line), not guessed from
  punctuation: the English does not always break where the Japanese does. Finding where each part starts in the audio
  is the generator's job (VOICEVOX does not say which pause came from `。`; one way is the mora count of each part).
- Split lines at the speeds above: basil, sparrows, train, river, short-life, woods, enough, last-thing, forgotten,
  afternoon, stone. In the tables below, `。` marks the Japanese split and the English sentence break the English one.

## The lines (content theirs in direction, wording my call)

32 lines: 16 to you, 16 to herself; 7 dark. Readings checked with VOICEVOX (all kanji read correctly). At the speeds
above most lines run 4 to 6 s; three long ones were trimmed (shown trimmed), and the longest now run about 8.5 s
(enough, last-thing, river, woods, forgotten), each with a sentence break where the subtitle splits.

### To you

| id | about | mood | Japanese | English subtitle |
| --- | --- | --- | --- | --- |
| basil | life | light | ベランダのバジル、やっと芽が出たの。待ってるあいだも、ちゃんと育ってたんだね | The basil on the balcony finally sprouted. It was growing the whole time I was waiting. |
| nothing | thought | light | 今日ね、なにもしなかったの。でも、いい一日だった気がする | I didn't do anything today. But it feels like it was a good day. |
| clouds | thought | light | ねえ、雲ってずっと形を変えてるのに、いつも雲だよね | Hey, clouds keep changing shape, but they're always clouds. |
| sparrows | life | light | 今朝ね、すずめが二羽、手すりに並んでたの。なに話してたんだろうね | This morning two sparrows sat side by side on the railing. I wonder what they were talking about. |
| tea-cool | life | light | お茶って、冷めるのを待つ時間も、おいしさのうちだと思うんだ | I think waiting for tea to cool is part of what makes it good. |
| seasons | thought | light | 急がなくても、季節はちゃんと来るんだよね | Even if you don't hurry, the seasons still come. |
| train | life | light | さっき、遠くで電車の音がしてね。どこかへ行く人がいるんだなって思ったの | Earlier I heard a train far away. It made me think someone out there is going somewhere. |
| shadows | thought | light | 影って、光があるから生まれるんだよね。なんか、ちょっと好き | Shadows only exist because there's light. I kind of like that. |
| river | book | light | この本にね、同じ川には二度入れないって書いてあるの。このお茶も、二度と同じ味じゃないのかな | This book says you can't step into the same river twice. Maybe this tea never tastes the same twice either. |
| short-life | book | light | 人生は短いんじゃなくて、短くしちゃってるんだって。ちょっと耳が痛いな | It says life isn't short; we're the ones who make it short. That one stings a little. |
| woods | book | light | 森で暮らした人がね、持ち物が少ないほど自由なんだって。この本だけは、手放せないけど | A man who lived in the woods says the less you own, the freer you are. I couldn't give up this book, though. |
| enough | book | light | しあわせには、友だちと、自由と、考える時間があればいいんだって。けっこう足りてるかも | It says all happiness needs is friends, freedom, and time to think. We might have enough already. |
| last-thing | book | light | 最後のことみたいに、ていねいにやりなさいだって。じゃあ、もう一ページ、ていねいに読もうかな | It says to do each thing as if it were the last. Then I'll read one more page, carefully. |
| wither | thought | dark | 芽が出たってことは、いつか枯れるってことなんだよね | If it sprouted, it means someday it will wither. |
| stars | thought | dark | 星から見たら、わたしたちの悩みなんて、ほこりより小さいんだろうね | From the stars, our worries are probably smaller than dust. |
| forgotten | book | dark, turns calm | いつか、だれもわたしたちのことを覚えていない日が来るんだって。それでも、今日のお茶はおいしいね | It says a day will come when no one remembers us. Still, today's tea is good. |

### To herself

| id | about | mood | Japanese | English subtitle |
| --- | --- | --- | --- | --- |
| warmth | thought | light | しあわせって、たぶんこれくらいの温度なんだろうな | Happiness is probably about this warm. |
| wind | thought | light | 風って、どこから来て、どこへ行くんだろ | Where does the wind come from, and where does it go… |
| waiting | thought | light | なにかを待ってる時間も、ちゃんと自分の時間なんだよね | Time spent waiting for something is still my own time. |
| chatting | thought | light | 考えるって、ひとりでするおしゃべりみたいだね | Thinking is like having a chat with yourself. |
| taller | life | light | バジル、明日はもう少し伸びてるかな | I wonder if the basil will be a little taller tomorrow. |
| quiet | thought | light | 静かなのって、音がないことじゃなくて、急がないことなのかも | Maybe quiet isn't the absence of sound. Maybe it's not being in a hurry. |
| sky | life | light | 今日の空、ちょっとだけ昨日とちがう色 | Today's sky is a slightly different colour from yesterday's. |
| unknown | thought | light | わからないことがあるって、まだ考えられるってことだよね | Not understanding something just means there's still more to think about. |
| butterfly | book | light | 蝶になった夢を見た人の話。どっちが夢だったんだろうね | The man who dreamed he was a butterfly. Which one was the dream? |
| not-enough | book | light | 足りないって思ってると、ずっと足りないままなんだって | If you keep feeling you don't have enough, you'll never have enough. |
| useless-tree | book | light | 役に立たない木だから、切られずに大きくなれたんだって。ふふ | The tree grew big because it was useless, so no one ever cut it down. Heh. |
| change | book | light | 変わらないものは、変わることだけ、か | The only thing that never changes is change itself, huh. |
| afternoon | thought | dark, turns calm | この午後も、もう二度と来ないんだな。だから、もう少しここにいよう | This afternoon will never come again. So I'll stay here a little longer. |
| pages | book | dark | ページをめくるたびに、残りが減っていく。人生みたい | Every page I turn, there's less left. Like life. |
| stone | book | dark | 岩を山の上まで押して、また転がり落ちて。わたしたちも、そうなのかな | Pushing a rock up the mountain, and it rolls back down. Are we like that too? |
| alone-room | book | dark | 人はひとりで部屋にじっとしていられないから、不幸になるんだって | It says people are unhappy because they can't sit quietly alone in a room. |

`ふふ` in useless-tree is a small spoken laugh in VOICEVOX's reading (フフ), not a non-word sound effect; if it comes
out electronic, drop it from the line.

**Listening checkpoint (my call):** generate all 32 lines first, before the scheduler and face work rest on them, and
have the owner listen. The builder can check timing and lip sync by machine but cannot judge how a line sounds: the
murmur speed and volume (0.82, 0.75), the ふふ, and any line that sounds unnatural are settled by that listen.

## Constraints

- Voice: VOICEVOX, 冥鳴ひまり, style ノーマル (id 14). Credit "VOICEVOX:冥鳴ひまり" (already in
  `web/public/voice/CREDITS.md`, written by the generator).
- Audio must start on its first sample so lip sync stays exact (today: WAV). Any other format must keep that.
- Lines are fetched only when she is about to say them (the greeting already works this way); the whole set is about
  3 minutes of audio, roughly 9 MB as WAV on the server, 150 to 400 KB per line fetched.
- The page stays local: the character and balcony files are purchased and git-ignored; the build is not deployed.
- Commits only when the owner asks.

## How it fits the existing code (for orientation)

- Lines and generation: `scripts/voice/lines.json` (manifest), `scripts/voice/generate_lines.py` (writes
  `web/public/voice/lines.json`, the WAVs, `CREDITS.md`). The manifest needs, per line, whether it is a greeting or
  small talk, who it is to (you or self) and its mood (light or dark), passed through to the web index. The greeting
  picker (`web/src/voice/pick-line.js`, wired in `web/src/viewer/main.js`) must then pick from greetings only.
- Playback and timing: `web/src/voice/speech.js` (audio clock, prefetch, unlock), `lipsync.js`, `greeting-plan.js`,
  `greeting.js` (look up, face, subtitle; the to-you behaviour is the greeting's, with a shorter linger).
- Her motion: `web/src/balcony/reader.js` (`attend`, stretch scheduling), `reading.js` (page turns, random look-ups,
  reading eye movement, `lookUpAt`, head aim), `head-aim.js`.
- Music: `web/src/music/player.js` (its own AudioContext and master gain), HUD mute in `web/src/hud/`.
- Test hooks follow the existing pattern (`?greet=0`, `?line=`, `window.lofiViewer`): at least a way to turn small talk
  off, to make it due quickly, to say a given line now, and to read its state.

## As built (2026-11-09)

- Lines come every 1 to 2 minutes (the owner's change); `?talkevery=<s>` checks it quickly, `?talk=0` turns it off,
  `?greet=0` now turns off only the greeting.
- Looks at the camera settle softly (smootherstep ease, 1.2 s for small talk, 1.3 s for the greeting); breathing eases
  at both ends and varies a little from breath to breath (an owner request while building).
- The glance aside is a 14° turn toward her right, the daybed side of the picture (checked in a frame).
- The eyes-only look is not picked (see Motion variety).

## Building on the uncommitted greeting (my call)

The greeting work is not committed yet, and commits happen only when the owner asks. Small talk is built on top of it in
this worktree. Changes to the greeting's own files stay limited to what small talk needs (greetings-only picking, mute,
volume and the music dip, and any core the to-you lines share with the greeting), so the greeting's tests keep passing
and the owner can still commit the two as separate changes if they ask before or during the build.

## Left to the builder

- How the scheduler is structured, and whether to-you talk reuses `startGreeting` or shares a common core with it.
- Exact face weights, linger and ease times, the murmur subtitle's exact size and opacity, the music dip's exact depth.
- Whether to prefetch the next line shortly before it is due (so a slow network does not make her late).
- The test plan, within the project's rules (unit tests for pure parts, Playwright for the page).

## Acceptance

- With the page open, she speaks roughly every 1 to 2 minutes, never during the greeting, a stretch, a page turn or a
  glance up, and never while the tab is hidden.
- To-you lines: she faces the camera (within about 3°), mouth on the voice, subtitles, then back to reading.
- To-herself lines: one of the to-herself motions, softer voice, murmur subtitles; the glance aside goes toward the
  daybed, never past the railing.
- Motions vary: never the same motion twice in a row; eyes-only and glance-mid-line looks still land on the camera.
- No line repeats before all 32 have played (across visits on the same browser); never two dark lines in a row.
- The music dips under her voice; mute silences her too.
- Every line plays through with lip sync closing on each pause, as the greeting's per-line tests check today.
