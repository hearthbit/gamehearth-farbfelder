import { botMove, createMatch, stepMatch, tickMs, type Match, type ProfileChange } from "@gamehearth/sdk/platform";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";
import farbfelder, {
  blobCooldownTicks,
  botSplatSquares,
  botTakeoverDetour,
  cellIndex,
  countCells,
  emptyCell,
  fieldSizes,
  gridHeight,
  gridWidth,
  roundTicks,
  startCell,
  stepsPerCell,
  ticksPerSecond,
  type Direction,
  type FarbfelderAction,
  type FarbfelderState,
  type Options,
} from "../src/index";

type FarbMatch = Match<FarbfelderState, FarbfelderAction>;
type Input = { player: string; action: FarbfelderAction };

const catalog = manifest;

function start(players = 2, seed = "farbfelder", options: Options = { spielzeit: 90, feld: "mittel" }): FarbMatch {
  const created = createMatch(farbfelder, { playerCount: players, seed, options, catalog });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.match;
}

function step(match: FarbMatch, inputs: Input[] = [], times = 1): FarbMatch {
  return stepWithChanges(match, inputs, times).match;
}

function stepWithChanges(match: FarbMatch, inputs: Input[] = [], times = 1): { match: FarbMatch; changes: ProfileChange[] } {
  let current = match;
  const changes: ProfileChange[] = [];
  for (let i = 0; i < times; i++) {
    const outcome = stepMatch(farbfelder, current, { inputs: i === 0 ? inputs : [], now: 0, dt: tickMs }, { catalog });
    if (!outcome.ok) {
      throw new Error(outcome.error.message);
    }
    for (const result of outcome.results) {
      if (!result.ok) {
        throw new Error(`input rejected: ${result.code}`);
      }
    }
    changes.push(...(outcome.changes ?? []));
    current = outcome.match;
  }
  return { match: current, changes };
}

function steer(player: string, dir: Direction): Input {
  const action: FarbfelderAction = { type: "steer", dir };
  return { player, action };
}

function blob(player: string): Input {
  const action: FarbfelderAction = { type: "blob" };
  return { player, action };
}

function placed(match: FarbMatch, changes: (state: FarbfelderState) => void): FarbMatch {
  const copy = JSON.parse(JSON.stringify(match)) as FarbMatch;
  changes(copy.state);
  return copy;
}

function owner(match: FarbMatch, x: number, y: number): string {
  return match.state.public.grid[cellIndex(x, y)] ?? "?";
}

function cell(match: FarbMatch, player: string): { x: number; y: number } {
  const figure = match.state.public.figures[player]!;
  return { x: figure.x / stepsPerCell, y: figure.y / stepsPerCell };
}

function put(state: FarbfelderState, player: string, x: number, y: number): void {
  const figure = state.public.figures[player]!;
  figure.x = x * stepsPerCell;
  figure.y = y * stepsPerCell;
}

function emptyField(state: FarbfelderState): void {
  state.public.grid = emptyCell.repeat(gridWidth * gridHeight);
}

describe("Farbfelder: setup", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])("places %i figures on different starting squares and colors every starting square", (players) => {
    const match = start(players);
    const view = match.state.public;
    expect(view.grid).toHaveLength(gridWidth * gridHeight);
    expect(view.ticksLeft).toBe(roundTicks);
    const starts = match.players.map((_, index) => startCell(index, players));
    expect(new Set(starts.map((point) => `${point.x},${point.y}`)).size).toBe(players);
    match.players.forEach((player, index) => {
      const point = starts[index]!;
      expect(point.x).toBeGreaterThanOrEqual(1);
      expect(point.x).toBeLessThan(gridWidth - 1);
      expect(point.y).toBeGreaterThanOrEqual(1);
      expect(point.y).toBeLessThan(gridHeight - 1);
      expect(cell(match, player)).toEqual(point);
      expect(owner(match, point.x, point.y)).toBe(String(index + 1));
      expect(view.figures[player]!.blobWait).toBe(0);
    });
    expect(countCells(view.grid, players)).toEqual(new Array(players).fill(1));
  });

  it.each([
    ["klein", 24, 14],
    ["mittel", 32, 18],
    ["gross", 40, 22],
  ] as const)("with field size %s, builds a field of %i × %i squares and places everyone on it", (feld, width, height) => {
    const match = start(8, `feld-${feld}`, { spielzeit: 90, feld });
    const view = match.state.public;
    expect(fieldSizes[feld]).toEqual({ width, height });
    expect([view.width, view.height]).toEqual([width, height]);
    expect(view.grid).toHaveLength(width * height);
    const starts = match.players.map((_, index) => startCell(index, 8, fieldSizes[feld]));
    expect(new Set(starts.map((point) => `${point.x},${point.y}`)).size).toBe(8);
    match.players.forEach((player, index) => {
      expect(cell(match, player)).toEqual(starts[index]);
      expect(view.grid[cellIndex(starts[index]!.x, starts[index]!.y, view)]).toBe(String(index + 1));
    });
  });

  it.each([60, 90, 120] as const)("takes %i seconds of game time from the option", (spielzeit) => {
    expect(start(2, "zeit", { spielzeit, feld: "mittel" }).state.public.ticksLeft).toBe(spielzeit * ticksPerSecond);
  });

  it("stops figures at the edge of a small field", () => {
    let match = start(2, "rand", { spielzeit: 60, feld: "klein" });
    match = step(match, [steer("p1", "right")], 200);
    expect(cell(match, "p1").x).toBe(23);
    match = step(match, [steer("p1", "down")], 200);
    expect(cell(match, "p1").y).toBe(13);
  });

  it("offers everyone the d-pad and the splat", () => {
    const match = start(2);
    expect(match.moves["p1"]).toContainEqual({ type: "blob" });
    expect(match.moves["p1"]).toContainEqual({ type: "steer", dir: "none" });
    expect(match.moves["p1"]).toHaveLength(6);
  });
});

describe("Farbfelder: moving", () => {
  it("moves one square every three ticks while pressed and colors every square it enters", () => {
    let match = placed(start(2), (state) => {
      emptyField(state);
      put(state, "p1", 5, 5);
    });
    match = step(match, [steer("p1", "right")], stepsPerCell);
    expect(cell(match, "p1")).toEqual({ x: 6, y: 5 });
    expect(owner(match, 6, 5)).toBe("1");
    match = step(match, [], stepsPerCell * 3);
    expect(cell(match, "p1")).toEqual({ x: 9, y: 5 });
    expect([7, 8, 9].map((x) => owner(match, x, 5))).toEqual(["1", "1", "1"]);
    expect(owner(match, 10, 5)).toBe(emptyCell);
  });

  it("paints over squares that belonged to someone else before", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
      state.public.grid = state.public.grid.slice(0, cellIndex(6, 5)) + "2" + state.public.grid.slice(cellIndex(6, 5) + 1);
    });
    expect(owner(match, 6, 5)).toBe("2");
    match = step(match, [steer("p1", "right")], stepsPerCell);
    expect(owner(match, 6, 5)).toBe("1");
  });

  it("stops on the next square after release", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
    });
    match = step(match, [steer("p1", "down")], 1);
    match = step(match, [steer("p1", "none")], stepsPerCell * 4);
    expect(cell(match, "p1")).toEqual({ x: 5, y: 6 });
  });

  it("takes exactly one step on a short tap", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
    });
    match = step(match, [steer("p1", "left"), steer("p1", "none")], stepsPerCell * 4);
    expect(cell(match, "p1")).toEqual({ x: 4, y: 5 });
  });

  it("remembers a tap during a step and then moves that way", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
    });
    match = step(match, [steer("p1", "right")], 1);
    match = step(match, [steer("p1", "up"), steer("p1", "none")], stepsPerCell * 4);
    expect(cell(match, "p1")).toEqual({ x: 6, y: 4 });
  });

  it("can reverse in the middle of a step", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
    });
    match = step(match, [steer("p1", "right")], 1);
    match = step(match, [steer("p1", "left")], 1);
    expect(match.state.public.figures["p1"]).toMatchObject({ x: 5 * stepsPerCell, heading: "left" });
  });

  it("stops at the edge and does not run off the field", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 0, 0);
      put(state, "p2", gridWidth - 1, gridHeight - 1);
    });
    match = step(match, [steer("p1", "left"), steer("p2", "down")], stepsPerCell * 3);
    expect(cell(match, "p1")).toEqual({ x: 0, y: 0 });
    expect(cell(match, "p2")).toEqual({ x: gridWidth - 1, y: gridHeight - 1 });
    match = step(match, [steer("p1", "up"), steer("p2", "right")], stepsPerCell * 3);
    expect(cell(match, "p1")).toEqual({ x: 0, y: 0 });
    expect(cell(match, "p2")).toEqual({ x: gridWidth - 1, y: gridHeight - 1 });
  });

  it("lets figures run through each other", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
      put(state, "p2", 6, 5);
    });
    match = step(match, [steer("p1", "right")], stepsPerCell);
    expect(cell(match, "p1")).toEqual({ x: 6, y: 5 });
    expect(owner(match, 6, 5)).toBe("1");
  });

  it("gives a square that two enter at the same moment to one of them at random", () => {
    const winners = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      let match = placed(start(2, `gleichzeitig-${seed}`), (state) => {
        emptyField(state);
        put(state, "p1", 4, 5);
        put(state, "p2", 6, 5);
      });
      match = step(match, [steer("p1", "right"), steer("p2", "left")], stepsPerCell);
      expect(cell(match, "p1")).toEqual({ x: 5, y: 5 });
      expect(cell(match, "p2")).toEqual({ x: 5, y: 5 });
      winners.add(owner(match, 5, 5));
    }
    expect([...winners].sort()).toEqual(["1", "2"]);
  });
});

describe("Farbfelder: splat", () => {
  it("colors the 3×3 squares around the figure, also those of others", () => {
    let match = placed(start(2), (state) => {
      emptyField(state);
      put(state, "p1", 10, 10);
      state.public.grid = state.public.grid.slice(0, cellIndex(11, 11)) + "2" + state.public.grid.slice(cellIndex(11, 11) + 1);
    });
    match = step(match, [blob("p1")]);
    for (let y = 9; y <= 11; y++) {
      for (let x = 9; x <= 11; x++) {
        expect(owner(match, x, y)).toBe("1");
      }
    }
    expect(owner(match, 12, 10)).toBe(emptyCell);
    expect(owner(match, 10, 8)).toBe(emptyCell);
    expect(countCells(match.state.public.grid, 2)).toEqual([9, 0]);
  });

  it("colors only the squares within the field in a corner", () => {
    let match = placed(start(2), (state) => {
      emptyField(state);
      put(state, "p1", 0, 0);
    });
    match = step(match, [blob("p1")]);
    expect(countCells(match.state.public.grid, 2)).toEqual([4, 0]);
  });

  it("then has to wait 8 seconds until it works again", () => {
    let match = step(start(2), [blob("p1")]);
    expect(match.state.public.figures["p1"]!.blobWait).toBe(blobCooldownTicks - 1);
    expect(match.moves["p1"]).not.toContainEqual({ type: "blob" });
    expect(match.moves["p2"]).toContainEqual({ type: "blob" });
    match = step(match, [], blobCooldownTicks - 2);
    expect(match.moves["p1"]).not.toContainEqual({ type: "blob" });
    match = step(match, [], 1);
    expect(match.state.public.figures["p1"]!.blobWait).toBe(0);
    expect(match.moves["p1"]).toContainEqual({ type: "blob" });
  });

  it("also works while moving and remembers where it splatted", () => {
    let match = placed(start(2), (state) => {
      put(state, "p1", 5, 5);
    });
    match = step(match, [steer("p1", "right")], 2);
    match = step(match, [blob("p1")]);
    expect(match.state.public.figures["p1"]).toMatchObject({ blobX: 6, blobY: 5 });
    expect(owner(match, 7, 6)).toBe("1");
  });

  it("lets the later one win when two splat at the same moment", () => {
    let match = placed(start(2), (state) => {
      emptyField(state);
      put(state, "p1", 10, 10);
      put(state, "p2", 11, 10);
    });
    match = step(match, [blob("p1"), blob("p2")]);
    expect(owner(match, 10, 10)).toBe("2");
    expect(owner(match, 9, 10)).toBe("1");
    expect(owner(match, 12, 10)).toBe("2");
  });
});

describe("Farbfelder: end", () => {
  it("lasts 90 seconds", () => {
    let match = start(2);
    match = step(match, [], roundTicks - 1);
    expect(match.result).toBeUndefined();
    match = step(match, [], 1);
    expect(match.result).toBeDefined();
    expect(match.moves).toEqual({ p1: [], p2: [] });
  });

  it("lets the one with the most squares win", () => {
    let match = placed(start(3), (state) => {
      state.public.ticksLeft = 1;
      state.public.grid = "1".repeat(10) + "2".repeat(12) + "3".repeat(11) + emptyCell.repeat(gridWidth * gridHeight - 33);
    });
    const last = stepWithChanges(match);
    expect(last.match.result).toEqual({ winners: ["p2"] });
    expect(last.changes).toEqual([{ player: "p2", op: "stat", id: "siege", value: 1 }]);
  });

  it("awards wins only in the last tick", () => {
    const run = stepWithChanges(start(2), [], roundTicks - 1);
    expect(run.match.result).toBeUndefined();
    expect(run.changes).toEqual([]);
    const last = stepWithChanges(run.match);
    expect(last.match.result).toBeDefined();
    expect(last.changes.map((change) => change.player)).toEqual(last.match.result?.winners);
  });

  it("lets everyone with the most squares win in a tie", () => {
    let match = placed(start(4), (state) => {
      state.public.ticksLeft = 1;
      state.public.grid = "1".repeat(7) + "2".repeat(3) + "3".repeat(7) + "4".repeat(5) + emptyCell.repeat(gridWidth * gridHeight - 22);
    });
    const last = stepWithChanges(match);
    expect(last.match.result).toEqual({ winners: ["p1", "p3"] });
    expect(last.changes).toEqual([
      { player: "p1", op: "stat", id: "siege", value: 1 },
      { player: "p3", op: "stat", id: "siege", value: 1 },
    ]);
  });

  it("counts the squares per player", () => {
    expect(countCells("0120210", 3)).toEqual([2, 2, 0]);
    expect(countCells("", 2)).toEqual([0, 0]);
  });
});

describe("Farbfelder: bot", () => {
  function own(state: FarbfelderState, mark: string): void {
    state.public.grid = mark.repeat(gridWidth * gridHeight);
  }

  function mark(state: FarbfelderState, x: number, y: number, owner: string): void {
    const index = cellIndex(x, y);
    state.public.grid = state.public.grid.slice(0, index) + owner + state.public.grid.slice(index + 1);
  }

  function holding(state: FarbfelderState, player: string, dir: Direction): void {
    const figure = state.public.figures[player]!;
    figure.dir = dir;
    figure.heading = dir;
    figure.blobWait = 40;
  }

  function scene(changes: (state: FarbfelderState) => void): FarbMatch {
    const match = placed(start(2), changes);
    return { ...match, moves: Object.fromEntries(match.players.map((player) => [player, farbfelder.legalMoves(match.state, player)])) };
  }

  function choice(match: FarbMatch, player = "p1") {
    return botMove(farbfelder, match, player, { now: 0 });
  }

  it("steers toward the nearest square that is not its own", () => {
    const match = scene((state) => {
      own(state, "1");
      mark(state, 2, 5, emptyCell);
      put(state, "p1", 5, 5);
      holding(state, "p1", "none");
    });
    expect(choice(match)).toEqual({ ok: true, chosen: "bot", action: { type: "steer", dir: "left" } });
  });

  it(`prefers an empty square to someone else's square that is less than ${botTakeoverDetour} squares nearer`, () => {
    const contested = (emptyY: number) =>
      scene((state) => {
        own(state, "1");
        mark(state, 6, 5, "2");
        mark(state, 5, emptyY, emptyCell);
        put(state, "p1", 5, 5);
        holding(state, "p1", "none");
      });
    expect(choice(contested(8))).toMatchObject({ chosen: "bot", action: { type: "steer", dir: "down" } });
    expect(choice(contested(5 + botTakeoverDetour + 2))).toMatchObject({ chosen: "bot", action: { type: "steer", dir: "right" } });
  });

  it("sends nothing while the held direction still leads to a nearest square, or between two squares", () => {
    const straight = scene((state) => {
      emptyField(state);
      put(state, "p1", 5, 5);
      holding(state, "p1", "right");
    });
    expect(choice(straight)).toEqual({ ok: true, chosen: "none" });
    const between = scene((state) => {
      own(state, "1");
      mark(state, 2, 5, emptyCell);
      put(state, "p1", 5, 5);
      holding(state, "p1", "up");
      state.public.figures["p1"]!.y -= 1;
    });
    expect(choice(between)).toEqual({ ok: true, chosen: "none" });
  });

  it("stops when every square is its own", () => {
    const match = scene((state) => {
      own(state, "1");
      put(state, "p1", 5, 5);
      holding(state, "p1", "down");
    });
    expect(choice(match)).toEqual({ ok: true, chosen: "bot", action: { type: "steer", dir: "none" } });
  });

  it(`splats when it is ready and at least ${botSplatSquares} of the squares around are not its own`, () => {
    const around = (foreign: number, blobWait = 0) =>
      scene((state) => {
        own(state, "1");
        const cells = [
          [11, 10],
          [11, 9],
          [11, 11],
          [10, 9],
          [10, 11],
          [9, 9],
        ] as const;
        cells.slice(0, foreign).forEach(([x, y], index) => mark(state, x, y, index % 2 === 0 ? emptyCell : "2"));
        put(state, "p1", 10, 10);
        holding(state, "p1", "right");
        state.public.figures["p1"]!.blobWait = blobWait;
      });
    expect(choice(around(botSplatSquares))).toEqual({ ok: true, chosen: "bot", action: { type: "blob" } });
    expect(choice(around(botSplatSquares - 1))).toEqual({ ok: true, chosen: "none" });
    expect(choice(around(botSplatSquares + 1, 1))).toEqual({ ok: true, chosen: "none" });
  });

  it("only ever picks a legal move or nothing, and a new direction at most once per square", () => {
    let match = start(3, "bot-moves", { spielzeit: 60, feld: "klein" });
    const lastTurn: Record<string, number> = {};
    let turns = 0;
    let splats = 0;
    for (let tick = 0; match.result === undefined; tick++) {
      const inputs: Input[] = [];
      for (const player of match.players) {
        const picked = choice(match, player);
        expect(picked.problem).toBeUndefined();
        expect(["bot", "none"]).toContain(picked.chosen);
        if (picked.action === undefined) {
          continue;
        }
        expect(match.moves[player]).toContainEqual(picked.action);
        inputs.push({ player, action: picked.action });
        if (picked.action.type === "blob") {
          splats += 1;
          continue;
        }
        const figure = match.state.public.figures[player]!;
        expect(picked.action.dir).not.toBe(figure.dir);
        expect(figure.x % stepsPerCell + (figure.y % stepsPerCell)).toBe(0);
        expect(tick - (lastTurn[player] ?? -stepsPerCell)).toBeGreaterThanOrEqual(stepsPerCell);
        lastTurn[player] = tick;
        turns += 1;
      }
      match = step(match, inputs);
    }
    expect(turns).toBeGreaterThan(30);
    expect(turns).toBeLessThan((3 * 60 * ticksPerSecond) / stepsPerCell / 4);
    expect(splats).toBeGreaterThanOrEqual(3 * 4);
  });

  it.each([
    [2, "klein"],
    [4, "mittel"],
    [8, "gross"],
  ] as const)("ends a match of %i bots on a %s field without a bot problem, and the bots paint a fair share each", (players, feld) => {
    let match = start(players, `bots-${players}-${feld}`, { spielzeit: 60, feld });
    for (let tick = 0; tick < 60 * ticksPerSecond + 5 && match.result === undefined; tick++) {
      const outcome = stepMatch(farbfelder, match, { inputs: [], now: 0, dt: tickMs, bots: match.players }, { catalog });
      if (!outcome.ok) {
        throw new Error(outcome.error.message);
      }
      expect(outcome.bots).toBeUndefined();
      match = outcome.match;
    }
    expect(match.result).toBeDefined();
    const view = match.state.public;
    const counts = countCells(view.grid, players);
    const painted = counts.reduce((sum, count) => sum + count, 0);
    expect(painted).toBeGreaterThanOrEqual(view.grid.length * 0.8);
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(view.grid.length / players / 4);
    }
  });
});
