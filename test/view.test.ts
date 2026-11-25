import { describe, expect, it } from "vitest";
import { texts } from "../client/src/texts";
import {
  blendFigures,
  blobStatus,
  cellsLabel,
  clock,
  controllerSound,
  controllerStatus,
  controllerView,
  countdownSeconds,
  finalLines,
  fitField,
  hurry,
  listNames,
  markColor,
  needsResend,
  padDirection,
  pressKey,
  releaseKey,
  steer,
  topKey,
  place,
  ranking,
  resultLine,
  screenLayout,
  screenSound,
  seatColor,
  seatColors,
  splashStrength,
  type Screen,
  type Snapshot,
} from "../client/src/view";
import { blobCooldownTicks, emptyCell, gridHeight, gridWidth, stepsPerCell, type Figure, type FarbfelderAction, type Public } from "../src/index";

const de = texts("de");
const en = texts("en");

const players = {
  p1: { name: "Anna", connected: true, you: true },
  p2: { name: "Ben", connected: true, you: false },
  p3: { name: "Clara", connected: true, you: false },
};
const seats = ["p1", "p2", "p3"];

function figure(x: number, y: number, changes: Partial<Figure> = {}): Figure {
  return { x: x * stepsPerCell, y: y * stepsPerCell, dir: "none", next: "none", heading: "none", blobWait: 0, blobX: x, blobY: y, ...changes };
}

function grid(p1: number, p2: number, p3: number): string {
  return "1".repeat(p1) + "2".repeat(p2) + "3".repeat(p3) + emptyCell.repeat(gridWidth * gridHeight - p1 - p2 - p3);
}

function view(changes: Partial<Public> = {}): Public {
  return {
    grid: grid(5, 9, 5),
    width: gridWidth,
    height: gridHeight,
    figures: { p1: figure(2, 2), p2: figure(10, 5), p3: figure(20, 8) },
    ticksLeft: 1800,
    ...changes,
  };
}

function snapshot(changes: Partial<Snapshot> = {}): Snapshot {
  const moves: FarbfelderAction[] = [{ type: "steer", dir: "none" }, { type: "blob" }];
  return { player: "p1", players: seats, public: view(), me: {}, moves, version: 1, tick: 1, ...changes };
}

describe("Farbfelder UI: TV", () => {
  it("blends figures between two updates and computes in squares, but jumps on large jumps", () => {
    const from = view({ figures: { p1: figure(2, 2), p2: figure(10, 5), p3: figure(20, 8) } });
    const to = view({ figures: { p1: { ...figure(2, 2), x: 2 * stepsPerCell + 1 }, p2: figure(1, 1), p3: figure(20, 8) } });
    const blended = blendFigures(from, to, 0.5);
    expect(blended["p1"]!.x).toBeCloseTo(2 + 0.5 / stepsPerCell);
    expect(blended["p2"]).toEqual({ x: 1, y: 1 });
    expect(blended["p3"]).toEqual({ x: 20, y: 8 });
  });

  it("fits the field with a margin into any area and centers it", () => {
    expect(fitField(400, 240, 840, 280, 20)).toEqual({ scale: 1, left: 220, top: 20 });
    expect(fitField(400, 240, 440, 1000, 20).scale).toBe(1);
  });

  it("leaves room on the TV for the header and the ranking", () => {
    const layout = screenLayout(1920, 1080, 1);
    const { field, board } = layout;
    expect(field.top).toBeGreaterThanOrEqual(layout.headerHeight);
    expect(field.left + gridWidth * field.scale).toBeLessThanOrEqual(board.left);
    expect(field.top + gridHeight * field.scale).toBeLessThanOrEqual(1080);
    expect(board.left + board.width).toBeLessThanOrEqual(1920);
    expect(board.rowHeight * 8).toBeLessThanOrEqual(gridHeight * field.scale);
    expect(field.scale).toBeGreaterThan(40);
  });

  it.each([
    [24, 14],
    [40, 22],
  ])("also fits a field of %i × %i squares plus the ranking on the TV", (width, height) => {
    const layout = screenLayout(1920, 1080, 1, { width, height });
    const { field, board } = layout;
    expect(field.left + width * field.scale).toBeLessThanOrEqual(board.left);
    expect(field.top + height * field.scale).toBeLessThanOrEqual(1080);
    expect(board.rowHeight * 8).toBeLessThanOrEqual(height * field.scale);
  });

  it("keeps the header and the field together on tall screens too and centers both", () => {
    const layout = screenLayout(1400, 1200, 1);
    const gapBelowHeader = layout.field.top - (layout.headerTop + layout.headerHeight);
    expect(gapBelowHeader).toBe(16);
    const below = 1200 - (layout.field.top + gridHeight * layout.field.scale);
    expect(Math.abs(below - 16 - layout.headerTop)).toBeLessThan(0.001);
    expect(screenLayout(1920, 1080, 1).headerTop).toBeGreaterThanOrEqual(0);
  });

  it("shows the remaining time as minutes and seconds and warns in the last 10 seconds", () => {
    expect(clock(1800)).toBe("1:30");
    expect(clock(1199)).toBe("1:00");
    expect(clock(19)).toBe("0:01");
    expect(clock(0)).toBe("0:00");
    expect(hurry(201)).toBe(false);
    expect(hurry(200)).toBe(true);
  });

  it("sorts the ranking by squares, in a tie by seat", () => {
    expect(ranking(view(), seats, players)).toEqual([
      { seat: "p2", name: "Ben", count: 9, color: seatColors[1]!.color },
      { seat: "p1", name: "Anna", count: 5, color: seatColors[0]!.color },
      { seat: "p3", name: "Clara", count: 5, color: seatColors[2]!.color },
    ]);
  });

  it("names the winner and squares at the end, everyone in a tie", () => {
    expect(resultLine(de, ["p2"], view(), seats, players)).toBe("Ben gewinnt mit 9 Kästchen!");
    expect(resultLine(de, ["p1", "p3"], view(), seats, players)).toBe("Gleichstand! Anna und Clara gewinnen mit je 5 Kästchen.");
    expect(resultLine(de, [], view(), seats, players)).toBe("Niemand gewinnt");
    expect(listNames(de, ["Anna", "Ben", "Clara"])).toBe("Anna, Ben und Clara");
    expect(finalLines(de, ranking(view(), seats, players))).toEqual(["1. Ben: 9 Kästchen", "2. Anna: 5 Kästchen", "2. Clara: 5 Kästchen"]);
    expect(cellsLabel(de, 1)).toBe("1 Kästchen");
  });

  it("makes a fresh splat flash briefly", () => {
    expect(splashStrength(figure(1, 1, { blobWait: blobCooldownTicks - 1 }))).toBeGreaterThan(0.8);
    expect(splashStrength(figure(1, 1, { blobWait: blobCooldownTicks - 20 }))).toBe(0);
    expect(splashStrength(figure(1, 1, { blobWait: 0 }))).toBe(0);
  });

  it("gives up to 8 seats different colors with names and colors squares in their owner's color", () => {
    const eight = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    expect(new Set(eight.map((seat) => seatColor(seat, eight).color)).size).toBe(8);
    expect(new Set(eight.map((seat) => seatColor(seat, eight).name)).size).toBe(8);
    expect(markColor("1")).toBe(seatColor("p1", eight).color);
    expect(markColor("8")).toBe(seatColor("p8", eight).color);
    expect(markColor(emptyCell)).toBeUndefined();
  });

  it(`plays the shared sounds on the TV: the start, the last ${countdownSeconds} seconds and the end`, () => {
    const screen =(tick: number, ticksLeft: number, result?: { winners: string[] }): Screen => ({
      players: seats,
      public: view({ ticksLeft }),
      version: tick,
      tick,
      ...(result === undefined ? {} : { result }),
    });
    expect(screenSound(undefined, screen(0, 1800))).toBeUndefined();
    expect(screenSound(screen(0, 1800), screen(1, 1799))).toBe("start");
    expect(screenSound(screen(5, 1795), screen(6, 1794))).toBeUndefined();
    expect(screenSound(screen(5, 121), screen(6, 120))).toBeUndefined();
    expect(screenSound(screen(5, 101), screen(6, 100))).toBe("tick");
    expect(screenSound(screen(5, 100), screen(6, 99))).toBeUndefined();
    expect(screenSound(screen(5, 21), screen(6, 20))).toBe("tick");
    expect(screenSound(screen(5, 1), screen(6, 0, { winners: ["p2"] }))).toBe("win");
    expect(screenSound(screen(6, 0, { winners: ["p2"] }), screen(6, 0, { winners: ["p2"] }))).toBeUndefined();
    expect(screenSound(screen(6, 0, { winners: ["p2"] }), screen(0, 1800))).toBeUndefined();
  });
});

describe("Farbfelder UI: phone", () => {
  it("shows name, color, squares, rank and remaining time", () => {
    const shown = controllerView(de, snapshot(), players);
    expect(shown).toMatchObject({ name: "Anna", colorName: "Gelb", cells: "5 Kästchen", canBlob: true });
    expect(shown.status).toBe("Platz 2 von 3 · noch 1:30");
    expect(place("p3", view(), seats)).toBe(2);
    expect(place("p2", view(), seats)).toBe(1);
  });

  it("shows when the splat is ready again", () => {
    expect(blobStatus(de, 0)).toEqual({ ready: true, label: "Klecks!", progress: 1 });
    expect(blobStatus(de, blobCooldownTicks)).toEqual({ ready: false, label: "Klecks in 8 s", progress: 0 });
    expect(blobStatus(de, 21)).toMatchObject({ ready: false, label: "Klecks in 2 s" });
    expect(blobStatus(de, 20).label).toBe("Klecks in 1 s");
    const waiting = snapshot({
      public: view({ figures: { p1: figure(2, 2, { blobWait: 100 }), p2: figure(10, 5), p3: figure(20, 8) } }),
      moves: [{ type: "steer", dir: "none" }],
    });
    expect(controllerView(de, waiting, players)).toMatchObject({ canBlob: false, blob: { ready: false, label: "Klecks in 5 s" } });
  });

  it("plays the personal sounds on the phone: your own splat, and when it is ready again", () => {
    const waiting = (p1: number, p2 = 0, changes: Partial<Snapshot> = {}): Snapshot =>
      snapshot({ public: view({ figures: { p1: figure(2, 2, { blobWait: p1 }), p2: figure(10, 5, { blobWait: p2 }), p3: figure(20, 8) } }), ...changes });
    expect(controllerSound(undefined, waiting(0))).toBeUndefined();
    expect(controllerSound(waiting(0), waiting(blobCooldownTicks - 1))).toBe("pop");
    expect(controllerSound(waiting(50), waiting(49))).toBeUndefined();
    expect(controllerSound(waiting(1), waiting(0))).toBe("select");
    expect(controllerSound(waiting(0), waiting(0))).toBeUndefined();
    expect(controllerSound(waiting(0, 0), waiting(0, blobCooldownTicks - 1))).toBeUndefined();
    expect(controllerSound(waiting(0, 1), waiting(0, 0))).toBeUndefined();
    expect(controllerSound(waiting(1), waiting(0, 0, { result: { winners: ["p1"] } }))).toBeUndefined();
    expect(controllerSound(waiting(40, 0, { result: { winners: ["p1"] } }), waiting(0, 0, { tick: 0 }))).toBeUndefined();
  });

  it("tells everyone at the end who won", () => {
    expect(controllerStatus(de, snapshot({ result: { winners: ["p1"] } }), players)).toBe("Du gewinnst!");
    expect(controllerStatus(de, snapshot({ result: { winners: ["p1", "p3"] } }), players)).toBe("Gleichstand! Du gewinnst zusammen mit Clara.");
    expect(controllerStatus(de, snapshot({ result: { winners: ["p2"] } }), players)).toBe("Ben gewinnt mit 9 Kästchen!");
    expect(controllerView(de, snapshot({ result: { winners: ["p2"] }, moves: [] }), players)).toMatchObject({
      over: true,
      canBlob: false,
      blob: { ready: false, label: "Runde vorbei" },
    });
  });

  it("reads out only the result, not the remaining time that changes every second", () => {
    expect(controllerView(de, snapshot(), players).announcement).toBe("");
    expect(controllerView(de, snapshot({ public: view({ ticksLeft: 1780 }) }), players).announcement).toBe("");
    expect(controllerView(de, snapshot({ result: { winners: ["p1"] }, moves: [] }), players).announcement).toBe("Du gewinnst!");
  });

  it("speaks English when the platform passes en", () => {
    expect(controllerView(en, snapshot(), players)).toMatchObject({
      colorName: "Yellow",
      cells: "5 squares",
      status: "Rank 2 of 3 · 1:30 left",
      blob: { ready: true, label: "Splat!" },
    });
    expect(blobStatus(en, 21).label).toBe("Splat in 2 s");
    expect(controllerStatus(en, snapshot({ result: { winners: ["p1"] } }), players)).toBe("You win!");
    expect(controllerStatus(en, snapshot({ result: { winners: ["p1", "p3"] } }), players)).toBe("Tie! You win together with Clara.");
    expect(controllerView(en, snapshot({ result: { winners: ["p2"] }, moves: [] }), players)).toMatchObject({
      status: "Ben wins with 9 squares!",
      blob: { label: "Round over" },
    });
    expect(resultLine(en, ["p1", "p3"], view(), seats, players)).toBe("Tie! Anna and Clara win with 5 squares each.");
    expect(resultLine(en, [], view(), seats, players)).toBe("Nobody wins");
    expect(finalLines(en, ranking(view(), seats, players))).toEqual(["1. Ben: 9 squares", "2. Anna: 5 squares", "2. Clara: 5 squares"]);
    expect(cellsLabel(en, 1)).toBe("1 square");
    expect([en.pad, en.up, en.down, en.squares]).toEqual(["D-pad", "Up", "Down", "Squares"]);
  });

  it("names the d-pad and every color in German and falls back to German for other languages", () => {
    expect([de.pad, de.up, de.left, de.right, de.down]).toEqual(["Steuerkreuz", "Hoch", "Links", "Rechts", "Runter"]);
    expect(seatColors.map((entry) => de[entry.name])).toEqual(["Gelb", "Blau", "Grün", "Rot", "Lila", "Orange", "Türkis", "Rosa"]);
    expect(seatColors.map((entry) => en[entry.name])).toEqual(["Yellow", "Blue", "Green", "Red", "Purple", "Orange", "Turquoise", "Pink"]);
    expect(texts("fr").squares).toBe("Kästchen");
    expect(texts("en-GB").squares).toBe("Squares");
  });

  it("returns to the key still held when a key is released", () => {
    let keys = pressKey([], "left");
    keys = pressKey(keys, "up");
    expect(topKey(keys)).toBe("up");
    keys = releaseKey(keys, "up");
    expect(topKey(keys)).toBe("left");
    expect(topKey(releaseKey(keys, "left"))).toBe("none");
  });

  it("sends the held direction again when it got lost on the server and nothing is in flight any more", () => {
    const moves: FarbfelderAction[] = [...(["up", "down", "left", "right", "none"] as const).map((dir) => steer(dir)), { type: "blob" }];
    const lost = snapshot({ moves });
    expect(needsResend(lost, "right", 0)).toBe(true);
    expect(needsResend(lost, "right", 1)).toBe(false);
    const arrived = snapshot({ moves, public: view({ figures: { p1: figure(2, 2, { dir: "right" }), p2: figure(10, 5), p3: figure(20, 8) } }) });
    expect(needsResend(arrived, "right", 0)).toBe(false);
    expect(needsResend({ ...lost, result: { winners: ["p1"] } }, "right", 0)).toBe(false);
    expect(needsResend({ ...lost, moves: [] }, "right", 0)).toBe(false);
  });

  it("turns the finger position on the d-pad into a direction", () => {
    expect(padDirection(0, -50, 10)).toBe("up");
    expect(padDirection(0, 50, 10)).toBe("down");
    expect(padDirection(-50, 10, 10)).toBe("left");
    expect(padDirection(50, -10, 10)).toBe("right");
    expect(padDirection(3, 4, 10)).toBe("none");
  });
});

describe("Name of the game", () => {
  it("is translated, because it describes the game", () => {
    expect(texts("de").name).toBe("Farbfelder");
    expect(texts("en").name).toBe("Color Fields");
  });
});
