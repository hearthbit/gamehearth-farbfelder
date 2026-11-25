# Farbfelder

A party game for Gamehearth, the self-hosted game platform. The TV shows the field, everyone steers their figure with their phone.

Farbfelder (color fields) is Gamehearth's second own game and the example for realtime with a TV and phones as controllers. It was created from the `realtime` template of the Gamehearth dev tool, built by an AI agent from a description in everyday language.

The game gets onto a Gamehearth server through a catalog, for example the [Gamehearth catalog](https://github.com/hearthbit/gamehearth-catalog): add the catalog in the admin view and install Farbfelder. To play, a TV or laptop opens the server's address with `/tv` and is paired in the lobby with a code; the phones join the room as usual.

## Rules

For 2 to 8 players. A round lasts 90 seconds (adjustable, see "Options").

- The field is a grid of squares, normally 32 × 18. Everyone has their own color and a figure on the field.
- On the phone there is a d-pad (up, down, left, right). As long as you press, the figure runs in that direction.
- Every square the figure runs over gets its color, even if it belonged to someone else before.
- The phone also has the **Splat** button ("Klecks"): it colors the 3 × 3 squares around the figure in one go. After that you have to wait 8 seconds until you can splat again. The phone shows how long it still takes.
- When time is up, whoever has the most squares wins. In a tie, everyone with the most wins.
- Whoever wins gets a win in their profile (`siege`). The platform's game page shows a leaderboard for it.
- On the TV you see the field with all figures and their names, the remaining time and, on the right, a ranking of how many squares everyone has.
- On the phone you see your name, your color, how many squares you have, the d-pad and the splat button.
- Sound, when it is switched on: the TV plays a jingle at the start, a tick in each of the last 5 seconds and a fanfare at the end; your phone plays your own splat and a short signal when the splat is ready again (see "Sound").
- Empty seats can be filled with bots (see "Bots").

### Options

The host sets them in the lobby:

- **Duration** ("Spielzeit"): 1 minute, 1.5 minutes (default) or 2 minutes.
- **Field size** ("Feldgröße"): small ("Klein", 24 × 14 squares), medium ("Mittel", 32 × 18, default) or large ("Groß", 40 × 22).

### Details

- **Field size:** as chosen in the lobby, no matter how many play; all sizes fit the TV format.
- **Speed:** A figure needs 0.15 seconds per square, so it manages a good 6 squares per second. Once across the medium field takes about 5 seconds.
- **Moving in whole squares:** Figures always stand on a square. A short tap means: exactly one square further. If you let go, the figure keeps running to the next square and stops there. If you already press the next direction during a step, the figure turns on the next square. Reversing works immediately.
- **D-pad on the phone:** You can drag your thumb on the d-pad from one direction to the next without letting go. If you hold the phone sideways, the d-pad is on the left and the splat button big on the right, like on a gamepad. With a keyboard, the arrow keys or W, A, S, D work, the splat with the space bar or K. If you briefly hold a second direction in addition and let it go, the figure keeps running in the first one. If a button of the d-pad has the focus, Enter presses that direction; the space bar stays the splat there too.
- **Start:** The figures stand evenly spread out; the starting square already has your own color, so everyone starts with 1 square. Before the start, Gamehearth itself counts down 3 seconds.
- **Pause:** If a phone (locked, no network) or the TV is gone, Gamehearth pauses the match until it is back and then counts down 3 seconds again; in an action game, whoever locks their phone would otherwise lose. A seat played by a bot never pauses the match.
- **When a square gets colored:** as soon as the figure stands halfway on it. Whoever stands still does not color again; if someone else runs over the square you are standing on, it belongs to them.
- **Encounters:** Figures do not block each other; you can run through others and stand on the same square. If two enter the same square at the same moment, one of the two gets it at random.
- **Splat:** It is ready right from the start and also works while running; the center is the square the figure is standing on at that moment. At the edge it only colors the squares that lie within the field (so 4 in a corner). If two splat at the same moment and the splats overlap, the overlapping part belongs to the one whose splat reached the server last. On the TV a fresh splat flashes briefly.
- **Colors** in seat order: yellow, blue, green, red, purple, orange, turquoise, pink. The phone also names your own color as a word.
- **Extras:** The phone also shows your own rank and the remaining time. On the TV the clock turns red in the last 10 seconds. At the end, the winners and all results are shown large on the TV, and every phone says whether you won.

### Bots

In the lobby the host can add bots until there are enough players, and whoever has to go during a match can let a bot play their seat; they take it back with a tap. A bot plays like a simple player:

- It runs to the nearest square that is not its own. An empty square counts as 3 squares nearer than a square of someone else, so it paints empty squares first and only takes others' squares when they are clearly closer.
- It decides on every square, keeps its direction as long as that still leads to such a square and only presses a new direction when it changes.
- It splats as soon as the splat is ready and at least 5 of the 9 squares around it are not its own.

A bot wins and loses like everyone else. A seat handed over to a bot keeps its player's profile, so a win goes to them.

### Sound

Gamehearth plays the sounds, and only when the sound switch of the device is on (off by default, in the menu of the game page; the TV has its own switch). On an iPhone the ringer must be on too. Nothing important is only heard.

- **TV** (for everyone): a short jingle at the start, a tick in each of the last 5 seconds, the winner fanfare at the end.
- **Phone** (only for you): a pop when your splat lands, a short signal when the splat is ready again.

## Languages

German (the default) and English. The platform picks the language of each device, so the TV and every phone in a room can each show their own; in `npm run dev` the selector at the top switches it. All texts of the game are in `client/src/texts.ts`.

## Cover

The cover is pixel art in 4:3, `client/public/cover.svg` (CC0). The platform shows it for the game, for example in the game list.

## Try it out

You need Node 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5180. At the top is the TV, below it a frame per phone. You can play each seat yourself (click into a frame and use the d-pad or the arrow keys) or give it to the game's bot with the "Bot" switch. At the top you choose how many play, and the "Sound" switch (off by default) turns the sounds on for the TV and all phones.

With `npm run dev -- --host` it also works with real phones on the Wi-Fi: open the TV at `/tv` on a large screen, each phone at `/p1`, `/p2` … That way the game feels real.

## Develop

This game is easy to build on with an AI agent (Claude Code, Cursor, Copilot …). The instructions for the agent are in [AGENTS.md](AGENTS.md).

| Command | What it does |
|---|---|
| `npm run dev` | starts the game locally with the TV and all phones in the browser |
| `npm test` | tests |
| `npm run typecheck` | type check |
| `npm run check` | checks the game like the platform does, with matches of random bots and of the game's own bot tick by tick; adds new profile IDs to `ids.lock` (belongs in the repo) |
| `npm run pack` | builds the game package for a catalog |

## License

Code under MIT, graphics under CC0 (see [LICENSE](LICENSE) and `manifest.json`).
