# Click to talk: design

Date: 2026-11-09. Status: approved by the owner 2026-11-09; built 2026-11-09 (plan: `docs/superpowers/plans/2026-11-09-click-to-talk.md`). The lines below were approved with it and voiced
after approval.

## Intent

Clicking Marycia is the visitor reaching out to her, and she answers by turning her attention to them. Usually she
just says something warm, glad they are there; about one time in three she **asks how they are**: a caring, unhurried
question with two or three answers to pick, and her reply depends on the pick. The point is that she **cares about the visitor**, in the
same calm, slightly philosophical voice as her small talk; sometimes a question touches something heavier and her
reply lands soft.

Owner's words: "user click on character should trigger her conversation. She is only clickable while she is reading
(not talking), and the conversation sometimes is just her talking, or she asked you something and user get to click on
options to get her different responses"; "mostly just ask user question - show her care"; on the drafted lines: "Those
are all good. I just want more." The owner chose the answer style **A · soft pills** (mockup below) and approved the
flow as played back.

## Goals

- Clicking (or tapping) her while she quietly reads starts a short conversation.
- About 1 click in 3: she asks a caring question; the visitor picks an answer; she replies to that answer.
- About 2 clicks in 3: she just says something warm (a "notice" line). (The owner first asked for mostly questions,
  then found that too many for a click: "That's too much question for click conversation".)
- Same voice, lip sync, subtitles (Japanese with English beneath), look at the camera and music dip as the greeting and
  small talk.
- Variety: 11 questions (27 replies), 20 notice lines, 3 lines for when the visitor doesn't answer. More drafted
  questions are set aside in the appendix, to swap in later.

## Non-goals

- Multi-step dialogue (a reply that asks a follow-up with new options). One question, one answer, one reply.
- Remembering what the visitor answered beyond the conversation itself (owner approved: no memory of answers).
- Typing free text, or any AI-generated replies. Every line is written and voiced in advance.
- A keyboard shortcut to start a conversation (the answer pills themselves are keyboard-reachable).
- Sending answers anywhere. Nothing leaves the browser; no analytics.

## Anti-goals (would make it a failure even if it works)

- She feels like a chatbot or a menu: options popping up before she has finished speaking, or a big UI panel.
- She feels needy or pushy: asking again and again, or scolding when the visitor doesn't answer.
- The page becomes a click toy: rapid clicks producing rapid lines.
- Options covering her face or the book.
- A heavier question that leaves the visitor worse off: every heavier reply must land gently.

## What the visitor sees

### Before clicking

- While she quietly reads, the pointer over **her body or the book she holds** becomes a hand, and a very faint warm
  glow comes up on her (subtle enough not to read as a game highlight). On phones there is no hover; a tap does the
  same as a click.
- She is **not clickable** while she is: in the intro (before start is pressed), greeting, saying a small-talk line,
  in a conversation, turning a page, looking up or glancing, in her break (book on her lap), or within the cool-down
  after a conversation. Then the pointer stays normal, there is no glow, and a click on her does nothing beyond what a
  click anywhere already does (it wakes the music).

### A question (about 1 in 3 clicks)

1. She looks up at the camera the soft way she does in the greeting (eased, with her small smile), and the music dips.
2. She asks her question. Mouth on the voice, subtitle shown as today.
3. Just after her last word, the answer pills fade in under the subtitle; the subtitle stays up. She keeps looking at
   you while she waits, breathing and blinking (her small idle life continues; the talking-head sway stops with her voice).
4. The visitor picks a pill. The pills fade out (the picked one briefly stays highlighted as they go). Her reply plays,
   with its own subtitle; the question's subtitle is replaced.
5. She lingers a moment, then eases back to her book.

**No answer:** if no pill is picked within **15 s** of the pills appearing, they fade out and she says one of the three
"let go" lines (gently, no reproach), then returns to reading.

### Just talk (about 2 in 3 clicks)

She looks up at you, says a notice line with its subtitle, lingers, and returns to reading.

### The answer pills (option A, chosen)

Rounded, see-through pills in a row beneath the subtitle, centred: Japanese on top, English small beneath, in the same
fonts, colours and soft shadow as the subtitles (`web/src/voice/subtitles.css`), on a dark translucent blur
(`rgba(40,24,12,.42)`, 1px light border). Mockup: `.superpowers/brainstorm/*/content/options-look-v2.html` (local).
**On phones (narrow, upright screens)** there is no room for both under her book: she asks with the subtitle as
usual, and once the pills appear the question's subtitle fades and the pills take its place (owner's choice). Nothing
covers her face, the book or her hands; if three pills do not fit in one row they wrap to two, still clear of the book
and the music line. Desktop keeps the subtitle with the pills beneath it. *Final review:* a phone held sideways (a short,
wide screen) counts as a phone too, and there the pills stand at the left, in the open balcony, clear of her and the book. They are real buttons: hover and keyboard
focus show a clear but quiet state; Tab reaches them, Enter or Space picks one. Clicking a pill is not a "tap anywhere"
click (it must not also trigger anything else, the same rule as the HUD buttons).

## Pacing and rules

- **No repeats:** questions are picked so none repeats until all 11 have been asked; notice lines likewise among
  themselves (all 20). Remembered in the browser (`localStorage`, as small talk does), so a returning visitor hears new ones
  first. Blocked storage still gives a full round per visit.
- **Question or notice:** 1 in 3 a question, 2 in 3 a notice, at random. Never two questions in a row (so a question
  always feels like an occasion, not a habit).
- **Never two heavier questions in a row** (the questions marked *soft-heavy* below), like dark small-talk lines today.
- **Cool-down:** after a conversation ends she is not clickable for **3 s** (the owner shortened it from 20 s after
  trying it: a 20 s wait read as "can't click her again").
- **Small talk:** a conversation pushes her next unprompted small-talk line back by a fresh wait (as if she had just
  spoken one), so the two never land close together. Small talk never starts during a conversation.
- **Her break:** the break never starts during a conversation (as with small talk today).
- **Sound:** a click is the user gesture browsers need, so her voice can play even before the music has started.
  Unlike small talk, she answers even if the music is paused (the visitor asked). Her voice follows the volume control
  and mute as today; muted, she still talks with subtitles.
- **Tab hidden:** if the tab is hidden mid-conversation, the conversation ends quietly (pills removed, she returns to
  reading); the question does not count as asked.

## The lines

All drafted here for the owner to read; the builder copies them into `scripts/voice/lines.json`. Japanese is what she
says; English is the subtitle beneath. Answer labels are short (Japanese with English beneath). Long lines are split
into subtitle parts at the sentence break, as small talk does. *soft-heavy* marks the questions that touch something
heavier; their replies land soft.

### Questions, answers and replies

| # | She asks | Answer → her reply |
| --- | --- | --- |
| 1 | ねえ、ちゃんとごはん食べた？<br>*Hey, did you eat properly?* | **食べたよ** *I did* → えらいね。それだけで、今日はもう十分だよ *Good. That alone is enough for today.*<br>**まだ** *Not yet* → 少しでいいから、何か食べてきて。待ってるから *Even a little. Go eat something, I'll be here.*<br>**お菓子だけ** *Just snacks* → ふふ、それもごはんってことにしよう。次はちゃんとね *Let's count that. Properly next time, okay?* |
| 2 | 肩、かたくなってない？ずっと画面見てたでしょう<br>*Are your shoulders stiff? You've been staring at a screen all day.* | **少し** *A little* → 一緒に回そうか。ゆっくり、後ろに *Let's roll them together. Slowly, backwards.*<br>**平気** *I'm fine* → ならよかった。でも、無理はしないでね *Good. Just don't push yourself.* |
| 3 | 最近、ちゃんと笑えてる？ *(soft-heavy)*<br>*Have you been able to laugh lately?* | **うん** *Yes* → よかった。その顔、ちょっと見てみたいな *I'm glad. I'd like to see that face.*<br>**あんまり** *Not really* → そういう時期もあるよ。笑えない日の自分も、ちゃんと自分だからね *There are seasons like that. The you who can't laugh is still you.* |
| 4 | 昨日は、よく眠れた？<br>*Did you sleep well last night?* | **ぐっすり** *Like a log* → いいなあ。眠れた夜は、それだけで小さな勝ちだよ *Lucky. A night of good sleep is a small win all on its own.*<br>**あんまり** *Not really* → そっか。今夜は、少し早めに目を閉じてみて *I see. Tonight, try closing your eyes a little early.*<br>**寝てない** *I didn't* → …だめだよ。ここで少し、目を休めていって。私、静かにしてるから *Hey. Rest your eyes here a while. I'll stay quiet.* |
| 5 | 今日は、どんな一日だった？<br>*What kind of day was it?* | **いい日** *A good one* → よかった。その感じ、少しだけ分けてね *I'm glad. Share a little of it with me.*<br>**ふつう** *Ordinary* → ふつうの日って、あとで一番なつかしくなるんだよ *Ordinary days are the ones you miss most, later.*<br>**しんどかった** *A hard one* → そっか。よく、ここまで来たね。今はもう、何もしなくていいよ *I see. You made it this far. You don't have to do anything now.* |
| 6 | 何か、心に引っかかってることある？ *(soft-heavy)*<br>*Is something weighing on your mind?* | **ある** *There is* → 言わなくていいよ。でも、ひとりで持ってなくていいからね *You don't have to say it. But you don't have to carry it alone.*<br>**特にない** *Not really* → なら、今日の心は軽いんだね。いいことだ *Then your heart is light today. That's good.* |
| 7 | もう少し、ここにいられる？<br>*Can you stay a little longer?* | **いるよ** *I'll stay* → うれしい。じゃあ、もう一章だけ読もうかな *I'm glad. Then I'll read one more chapter.*<br>**そろそろ行く** *I have to go soon* → そっか。いってらっしゃい。ここは、ずっとここにあるから *Okay. Take care. This place will always be here.* |
| 8 | ひとりで、さびしくない？ *(soft-heavy)*<br>*Aren't you lonely, on your own?* | **大丈夫** *I'm okay* → そっか。でも、さびしくなったら、ここに来てね *Okay. But if you ever are, come here.*<br>**少しさびしい** *A little* → 私もね、ときどき。だから今、ここにいてくれてうれしいよ *Me too, sometimes. That's why I'm glad you're here now.* |
| 9 | 最近、自分のこと、少しは好きでいられてる？ *(soft-heavy)*<br>*Lately, have you been able to like yourself, even a little?* | **うん** *Yes* → よかった。それ、いちばん大事な仕事かもしれないね *I'm glad. That might be the most important job there is.*<br>**あんまり** *Not really* → そっか。じゃあ、その分、私が好きでいるね。今はそれで、いいことにしよう *I see. Then I'll like you for both of us. Let that be enough for now.*<br>**わからない** *I don't know* → わからなくて、いいんだよ。決めなくても、ちゃんと生きていけるから *That's okay. You can live just fine without deciding.* |
| 10 | もし、抱えてるものをひとつ置いていけるなら、何にする？ *(soft-heavy)*<br>*If you could set down one thing you carry, what would it be?* | **不安** *Worry* → 不安はね、未来を大事にしてる証拠なんだって。でも今は、少しだけここに置いていって *They say worry means you care about the future. But for now, leave a little of it here.*<br>**疲れ** *Tiredness* → じゃあ、ここに置いていって。本と一緒に、私が持っててあげる *Then leave it here. I'll hold it for you, with my book.*<br>**過去** *The past* → 過去は置いていけないけど、軽くはできるよ。少しずつ、ね *You can't leave the past behind, but you can make it lighter. Little by little.* |
| 11 | 子どものころ、何になりたかった？<br>*When you were little, what did you want to be?* | **覚えてる** *I remember* → その子、今もどこかにいるよ。たまには、思い出してあげてね *That child is still in there somewhere. Remember them now and then.*<br>**忘れちゃった** *I forgot* → いいよ。その子が見てた空は、たぶん今と同じだから *That's okay. The sky that child looked at is probably the same one now.* |

### Notice lines (just talk when clicked)

None of these asks anything, so the visitor never waits for pills that do not come.

1. …あ、いたんだ。ううん、なんでもない。いてくれて、うれしいだけ *Oh, you're there. No, it's nothing. I'm just glad you're here.*
2. ん？なあに。顔、見たくなった？ *Hm? What is it? Wanted to see my face?*
3. この章、すごくいいの。読み終わったら、話してあげるね *This chapter is really good. I'll tell you about it when I'm done.*
4. ねえ、知ってた？何もしない時間も、ちゃんと時間なんだよ *Hey, did you know? Time spent doing nothing is still time.*
5. 来てくれてありがとう。それだけ、言いたかったの *Thank you for coming. That's all I wanted to say.*
6. 今日の風、気持ちいいね。そっちにも、届いてるといいな *The breeze is lovely today. I hope it reaches you too.*
7. 無理しなくていいよ。ここでは、ただいるだけでいいから *You don't have to push. Here, just being is enough.*
8. …ふふ。ちょっと、目が合っちゃったね *Heh. Our eyes met, just now.*
9. …あ。ちょうど今、思い出してたところ。何をかは、ないしょ *Oh. I was just remembering something. What, is a secret.*
10. ここ、いい場所でしょう。いつでも来ていいからね *Nice spot, isn't it? You can come anytime.*
11. 本の中の人もね、今ちょうど、休憩してるところなの *The people in the book are taking a break right now too.*
12. ん…なんだか、眠くなってきちゃった。まだ読むけどね *Mm... I'm getting a little sleepy. I'll keep reading, though.*
13. ページの音、好きなんだ。紙が、ちゃんと生きてる感じがして *I love the sound of pages. Like the paper is alive.*
14. 静かだね。この静かさ、ふたりで分けてるみたい *It's quiet. Like we're sharing the quiet, the two of us.*
15. そばにいてくれるだけで、ちょっと安心するの。不思議だね *Just having you near makes me feel a little safer. Funny, isn't it?*
16. 今日も、ちゃんとここにいるよ。だから、安心して *I'm here today too. So don't worry.*
17. ふふ、本に夢中で、気づかなかった。ごめんね *Heh, I was so into my book I didn't notice you. Sorry.*
18. この本、読み終わるのが、ちょっともったいないな *I almost don't want this book to end.*
19. 夕方になったら、光がもっとやさしくなるよ。それまで、いてくれたらうれしいな *The light gets even softer toward evening. I'd be glad if you stayed till then.*
20. 髪、風でちょっとぐしゃぐしゃ。見なかったことにしてね *My hair's a bit of a mess from the wind. Pretend you didn't see.*

### Let-go lines (no answer within 15 s)

1. …ううん、いいの。また今度ね *It's okay. Another time.*
2. 答えなくても、大丈夫。聞けただけで、うれしいから *You don't have to answer. I'm glad I got to ask.*
3. ふふ、考えちゃった？ゆっくりでいいよ *Heh, got you thinking? Take your time.*

## Her motion and face

- Looking at you: the same look-up the greeting and small talk to you use (exact face aim, soft ease, level head,
  talking-head sway and dips while she speaks).
- Face (*builder's-check call, matching small talk today, where dark lines to you get a calm face and no smile*):
  - Questions marked *soft-heavy* (#3, #6, #8, #9, #10) are asked with her calm, relaxed face, no smile.
  - Every other question, every notice line and the light replies get her small-talk smile.
  - Replies to the harder answers get a softer, smaller smile (gentle, not cheerful): #3 あんまり, #4 あんまり and
    寝てない, #5 しんどかった, #6 ある, #8 少しさびしい, #9 あんまり and わからない, #10 all three.
  - Let-go lines: the small-talk smile.
- While waiting for an answer: she holds the look, with her breathing and blinking; no sway (she is not speaking).
- After the reply: she lingers about 1 s, then eases back to her book (as small talk does).

### Motion variety (added 2026-11-09)

The owner approved four subtle varieties ("All your subtle varieties are fine to me. You may create new as you wish"),
so conversations do not all move the same way. All stay small: she never looks away from you for long, and nothing
covers the answers.

- **Waiting for your answer:** a slight, curious head tilt (to one side at random) eases in as the answers appear and
  eases out when she replies or lets it go.
- **When you pick:** a small nod (about 2°) before her reply.
- **A reply to a harder answer** (the gentler-smile replies): her eyelids lower softly over its first sentence, as if
  taking it in, then she looks at you again.
- **Notices vary how she looks up** (never the same way twice in a row): a full look up as now; **eyes first** (she
  starts speaking toward her book and looks up at you partway through, only for lines long enough, as small talk does);
  or **with a tilt** (a small head tilt as she speaks).
- *Builder's additions:* a small nod at the end of a light line to you (as small talk does); a heavier question is
  looked up into a little more slowly; a let-go line starts with her eyes closing for a moment ("…ううん").

## Constraints

- Voice: VOICEVOX 冥鳴ひまり with the same settings as small talk (slow speed, longer pause between sentences:
  `scripts/voice/generate_lines.py`); credit "VOICEVOX:冥鳴ひまり" is already shown on the page.
- Audio stays WAV, like the existing lines, so lip-sync timing is exact. About 61 new clips (~17 MB) join the 37
  existing ones in `web/public/voice/` and in git. Only what a conversation needs is downloaded: the question when she
  is clicked (start it at the click), and its replies plus one let-go line while she asks.
- Everything stays front-end only. Nothing is sent anywhere.
- Must work with a mouse, a touch screen and the keyboard (for the pills), on a phone-sized screen.
- The existing test hooks keep working; add hooks in the same style (a query parameter to pick a question or notice,
  and `window.lofiViewer` calls to start a conversation and to pick an answer) so it can be checked without waiting.
- The repo is about to go public: no private files, and the design notes stay text.

## Left to the builder

- Names: line kinds and fields in `lines.json` (for example `ask` with its `answers` and reply ids, `reply`, `notice`,
  `letgo`), module names, hook names.
- How the hit test is done (a ray against her meshes and the book), and how the glow is drawn, within "very faint".
- Exact timings not fixed above (pill fade times, linger), matching the feel of the greeting and small talk.
- How the conversation shares code with small talk (`web/src/voice/talk.js`, `talk-plan.js`, `small-talk.js`).

## Tests the owner expects

Unit tests for the decisions (when she is clickable, picking with no repeats, the 1-in-3 mix, no two questions and no two heavy questions in a row,
the 15 s and 3 s rules); browser tests for a full question with each kind of answer, a notice, no answer, not
clickable while busy, the pills on a phone-sized screen and by keyboard; generator tests for the new line kinds.

## Appendix: questions set aside (not voiced)

a to l: drafted, liked by the owner, and set aside when the mix changed to one question in three. m to p: the first
drafts of questions 9 to 12, replaced by deeper ones at the owner's request ("a bit weird"). q and r: spare deeper
questions drafted with the new 9 to 12. s: dropped by the owner ("weird"). Any of them can replace one
of the questions above before voicing (the face rules then follow the same pattern).

| | She asks | Answer → her reply |
| --- | --- | --- |
| a | お水、飲んでる？<br>*Have you been drinking water?* | **飲んでる** *I have* → えらい。体って、ちゃんと聞いてるからね *Good. Your body is listening, you know.*<br>**忘れてた** *I forgot* → じゃあ、今ひとくち。待ってるね *Then have a sip now. I'll wait.* |
| b | そっちは、今日晴れてる？<br>*Is it sunny where you are today?* | **晴れ** *Sunny* → 同じ空かな。ここも、ずっとあったかいよ *Maybe it's the same sky. It's been warm here all day.*<br>**くもり** *Cloudy* → くもりの日は、光がやさしいから好き *I like cloudy days. The light is gentle.*<br>**雨** *Rainy* → 雨の音、ここまで聞こえたらいいのに。傘、忘れないでね *I wish I could hear your rain from here. Don't forget your umbrella.* |
| c | 最近、自分にきびしくしてない？ *(soft-heavy)*<br>*Have you been too hard on yourself lately?* | **してるかも** *Maybe* → やっぱり。今日くらいは、自分の味方でいてあげて *I thought so. Just for today, be on your own side.*<br>**してない** *No* → よかった。それ、案外むずかしいことなんだよ *Good. That's harder than it sounds.* |
| d | 寒くない？ちゃんとあったかくしてる？<br>*Aren't you cold? Are you keeping warm?* | **あったかい** *I'm warm* → よかった。ひざ掛け、貸そうと思ってたの *Good. I was about to lend you my blanket.*<br>**ちょっと寒い** *A little cold* → 何か一枚、羽織ってきて。風邪ひいたら、本も読めないよ *Go put something on. With a cold, you can't even read.* |
| e | 目、疲れてない？<br>*Are your eyes tired?* | **疲れてる** *They are* → 少しだけ、遠くを見て。窓の外とか、空とか *Look far away for a bit. Out the window, at the sky.*<br>**平気** *I'm fine* → ならいいけど。まばたき、忘れないでね *Okay. Don't forget to blink.* |
| f | 今日は、外に出た？<br>*Did you go outside today?* | **出たよ** *I did* → いいね。外の空気って、それだけで少し人を直すんだよ *Nice. Outside air mends people a little, all by itself.*<br>**出てない** *I didn't* → そういう日もあるよ。せめて窓、少し開けてね *Days like that happen. At least open a window a little.* |
| g | 何か、楽しみにしてることある？<br>*Is there something you're looking forward to?* | **ある** *Yes* → いいな。楽しみがあると、明日がちょっと近くなるよね *Lovely. Something to look forward to brings tomorrow a little closer.*<br>**思いつかない** *Can't think of one* → じゃあ、明日の天気でも楽しみにしよう。それで十分だよ *Then let's look forward to tomorrow's weather. That's enough.* |
| h | 今日、だれかと話した？<br>*Did you talk to anyone today?* | **話した** *I did* → いいね。声って、使わないとさびしがるから *Good. Voices get lonely when you don't use them.*<br>**話してない** *I didn't* → じゃあ、今日は私が話し相手。それで、いいかな *Then today I'm the one you talk to. Is that all right?* |
| i | 今日、何かひとつ、いいことあった？<br>*Did one good thing happen today?* | **あった** *Yes* → よかった。それ、寝る前にもう一回思い出してね *I'm glad. Remember it once more before you sleep.*<br>**なかった** *No* → じゃあ、ここに来たのを、いいことにしよう *Then let's count coming here as the good thing.* |
| j | がんばりすぎてない？<br>*Aren't you working too hard?* | **がんばってる** *I am* → 知ってる。だから、ここでは休んでいいんだよ *I know. That's why you can rest here.*<br>**ほどほど** *Just enough* → ほどほどが、いちばんむずかしくて、いちばんえらい *Just enough is the hardest, and the best.* |
| k | 本、好き？<br>*Do you like books?* | **好き** *I do* → やっぱり。なんとなく、そんな気がしてた *I thought so. I had a feeling.*<br>**あんまり** *Not really* → いいよ。私が読んでるのを、見てるだけでも *That's fine. You can just watch me read.* |
| l | 何もかも、どうでもよくなる日って、ある？ *(soft-heavy)*<br>*Do you have days when nothing seems to matter?* | **ある** *I do* → 私もある。でもね、そういう日も、ちゃんと終わるんだよ。ゆっくりでいい *Me too. But those days end too. Take it slowly.*<br>**ない** *No* → そっか。もしいつか来ても、ここ、覚えておいてね *I see. If one ever comes, remember this place.* |
| m | ちょっとだけ、一緒に深呼吸しない？<br>*Want to take a deep breath with me?* | **する** *Sure* → 吸って…はいて。ね、少しだけ、ゆるんだでしょう *Breathe in... and out. See? Something loosened, a little.*<br>**いまはいい** *Not now* → うん。したくなったら、いつでもね *Okay. Whenever you want to.* |
| n | そっちは、今なん時ごろ？<br>*What time is it where you are?* | **朝** *Morning* → おはよう。今日がやさしい日になりますように *Good morning. I hope today is gentle with you.*<br>**昼** *Daytime* → お昼か。ちゃんと休憩、とってね *Midday, then. Make sure you take a break.*<br>**夜** *Night* → 夜まで、おつかれさま。もう少ししたら、ちゃんと寝るんだよ *Well done, getting through to night. Go to bed soon, okay?* |
| o | 今日のこころは、どんな天気？ *(soft-heavy)*<br>*What's the weather in your heart today?* | **晴れ** *Clear* → いいね。その晴れ、長続きしますように *Lovely. May it stay clear a while.*<br>**くもり** *Cloudy* → くもりの日は、無理に晴れなくていいんだよ *On a cloudy day, you don't have to force the sun out.*<br>**雨** *Rain* → 雨の日は、雨のままでいいよ。止むまで、ここにいよう *Let the rain be rain. Stay here until it stops.* |
| p | お茶、いれようか？画面ごしだけど<br>*Shall I make you some tea? Through the screen, though.* | **おねがい** *Please* → はい、どうぞ。気持ちだけは、ちゃんと届くはず *Here you go. At least the thought should reach you.*<br>**大丈夫** *I'm okay* → そっか。じゃあ、私だけ飲むね。ふふ *Okay. Then I'll drink it myself.* |
| q | 生まれ変わったら、また自分になりたい？ *(soft-heavy)*<br>*If you were born again, would you want to be you again?* | **なりたい** *Yes* → すてき。それって、今を大事にしてるってことだよ *That's lovely. It means you treasure now.*<br>**わからない** *I don't know* → 私も。でも、もう一回この本を読めるなら、また私がいいかな *Me neither. But if I got to read this book again, I'd want to be me.*<br>**べつの人がいい** *Someone else* → そっか。でもね、あなたに会えたのは、あなたがあなただからだよ *I see. But I got to meet you because you're you.* |
| r | 最近、何かを美しいって思った？<br>*Lately, have you found something beautiful?* | **あった** *Yes* → いいな。美しいものに気づける日は、心が起きてる日だよ *Lovely. Days you notice beauty are days your heart is awake.*<br>**思い出せない** *Can't remember* → じゃあ、今日の分は、この光にしよう。ほら、きれいでしょう *Then let today's be this light. See how pretty it is.* |
| s | 今、だれかに言ってほしい言葉って、ある？ *(soft-heavy)*<br>*Is there something you wish someone would say to you right now?* | **「がんばったね」** *"You did well"* → …がんばったね。ほんとうに。見えないところまで、ちゃんと *You did well. Really. Even the parts no one saw.*<br>**「大丈夫だよ」** *"It'll be okay"* → 大丈夫だよ。今すぐじゃなくても、ちゃんと大丈夫になるから *It'll be okay. Maybe not right away, but it will.*<br>**「ここにいていい」** *"You can stay"* → ここにいていいよ。理由なんて、いらないから *You can stay here. You don't need a reason.* |
