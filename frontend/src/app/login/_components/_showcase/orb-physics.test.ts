import { describe, expect, it } from "vitest";
import {
  GLOW_AMBIENT_SPEED,
  GLOW_BOUNCE,
  GLOW_EDGE_MARGIN,
  GLOW_INFLUENCE_RADIUS,
  GLOW_MAX_SPEED,
  applyCursorRepulsion,
  bounceOffEdges,
  clampSpeed,
  createOrbStates,
  resolveOrbCollision,
  spawnOrbs,
  stepOrbPhysics,
  type OrbBody,
  type OrbState,
} from "./orb-physics";

const BOUNDS = { width: 600, height: 400 };

/** A state at the given offset and velocity. */
function makeState(offsetX = 0, offsetY = 0, velocityX = 0, velocityY = 0): OrbState {
  return { offset: { x: offsetX, y: offsetY }, velocity: { x: velocityX, y: velocityY } };
}

/** An orb resting at a fixed point. */
function makeOrb(restX: number, restY: number, radius = 50): OrbBody {
  return { radius, rest: () => ({ x: restX, y: restY }) };
}

/** A random source that always returns the same value. */
const constantRandom = (value: number) => () => value;

describe("createOrbStates", () => {
  it("creates independent resting states", () => {
    const states = createOrbStates(2);

    expect(states).toEqual([makeState(), makeState()]);
    states[0].offset.x = 5;
    expect(states[1].offset.x).toBe(0);
  });
});

describe("spawnOrbs", () => {
  it("places orbs inside the panel margins and sets them drifting at ambient speed", () => {
    const orbs = [makeOrb(100, 100)];
    const states = createOrbStates(1);

    spawnOrbs(orbs, states, BOUNDS, constantRandom(0));

    expect(states[0].offset).toEqual({ x: GLOW_EDGE_MARGIN - 100, y: GLOW_EDGE_MARGIN - 100 });
    expect(Math.hypot(states[0].velocity.x, states[0].velocity.y)).toBeCloseTo(GLOW_AMBIENT_SPEED);
  });

  it("can spawn as far as the opposite margin", () => {
    const states = createOrbStates(1);

    spawnOrbs([makeOrb(0, 0)], states, BOUNDS, constantRandom(1));

    expect(states[0].offset).toEqual({
      x: BOUNDS.width - GLOW_EDGE_MARGIN,
      y: BOUNDS.height - GLOW_EDGE_MARGIN,
    });
  });
});

describe("applyCursorRepulsion", () => {
  it("pushes the orb directly away from a nearby cursor", () => {
    const state = makeState();

    applyCursorRepulsion(state, { x: 100, y: 100 }, { x: 50, y: 100, active: true });

    expect(state.velocity.x).toBeGreaterThan(0);
    expect(state.velocity.y).toBe(0);
  });

  it("pushes harder the closer the cursor is", () => {
    const nearState = makeState();
    const farState = makeState();

    applyCursorRepulsion(nearState, { x: 100, y: 100 }, { x: 90, y: 100, active: true });
    applyCursorRepulsion(farState, { x: 100, y: 100 }, { x: 0, y: 100, active: true });

    expect(nearState.velocity.x).toBeGreaterThan(farState.velocity.x);
  });

  it("ignores a cursor beyond the influence radius", () => {
    const state = makeState();

    applyCursorRepulsion(state, { x: 0, y: 0 }, { x: GLOW_INFLUENCE_RADIUS, y: 0, active: true });

    expect(state.velocity).toEqual({ x: 0, y: 0 });
  });

  it("ignores the cursor once it has left the panel", () => {
    const state = makeState();

    applyCursorRepulsion(state, { x: 100, y: 100 }, { x: 99, y: 100, active: false });

    expect(state.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe("clampSpeed", () => {
  it("caps a flung orb at the maximum speed, keeping its direction", () => {
    const velocity = { x: 300, y: 400 };

    clampSpeed(velocity, constantRandom(0));

    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(GLOW_MAX_SPEED);
    expect(velocity.y / velocity.x).toBeCloseTo(4 / 3);
  });

  it("raises a slowing orb back to the ambient drift, keeping its direction", () => {
    const velocity = { x: 0.03, y: 0.04 };

    clampSpeed(velocity, constantRandom(0));

    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(GLOW_AMBIENT_SPEED);
    expect(velocity.y / velocity.x).toBeCloseTo(4 / 3);
  });

  it("sends a motionless orb off in a random direction", () => {
    const velocity = { x: 0, y: 0 };

    clampSpeed(velocity, constantRandom(0.25));

    expect(velocity.x).toBeCloseTo(0);
    expect(velocity.y).toBeCloseTo(GLOW_AMBIENT_SPEED);
  });

  it("leaves a speed within range untouched", () => {
    const velocity = { x: 3, y: 4 };

    clampSpeed(velocity, constantRandom(0));

    expect(velocity).toEqual({ x: 3, y: 4 });
  });
});

describe("resolveOrbCollision", () => {
  it("separates overlapping orbs evenly along the line between them", () => {
    const left = makeState();
    const right = makeState();

    resolveOrbCollision(makeOrb(100, 100), left, makeOrb(160, 100), right, BOUNDS);

    // 100 apart is required (two radii of 50); they were 60 apart, so each moves 20.
    expect(left.offset).toEqual({ x: -20, y: 0 });
    expect(right.offset).toEqual({ x: 20, y: 0 });
  });

  it("bounces orbs that are closing in, losing energy to the bounce factor", () => {
    const left = makeState(0, 0, 2, 0);
    const right = makeState(0, 0, -2, 0);

    resolveOrbCollision(makeOrb(100, 100), left, makeOrb(160, 100), right, BOUNDS);

    expect(left.velocity.x).toBeCloseTo(-2 * GLOW_BOUNCE);
    expect(right.velocity.x).toBeCloseTo(2 * GLOW_BOUNCE);
  });

  it("separates but doesn't bounce orbs already moving apart", () => {
    const left = makeState(0, 0, -1, 0);
    const right = makeState(0, 0, 1, 0);

    resolveOrbCollision(makeOrb(100, 100), left, makeOrb(160, 100), right, BOUNDS);

    expect(left.velocity.x).toBe(-1);
    expect(right.velocity.x).toBe(1);
  });

  it("leaves orbs that don't touch alone", () => {
    const left = makeState(0, 0, 1, 0);
    const right = makeState(0, 0, -1, 0);

    resolveOrbCollision(makeOrb(100, 100), left, makeOrb(300, 100), right, BOUNDS);

    expect(left).toEqual(makeState(0, 0, 1, 0));
    expect(right).toEqual(makeState(0, 0, -1, 0));
  });
});

describe("bounceOffEdges", () => {
  const rest = { x: 300, y: 200 };

  it("stops an orb at the left margin and sends it back right, damped", () => {
    const state = makeState(-1000, 0, -5, 0);

    bounceOffEdges(state, rest, BOUNDS);

    expect(state.offset.x).toBe(GLOW_EDGE_MARGIN - rest.x);
    expect(state.velocity.x).toBeCloseTo(5 * GLOW_BOUNCE);
  });

  it("stops an orb at the bottom margin and sends it back up, damped", () => {
    const state = makeState(0, 1000, 0, 5);

    bounceOffEdges(state, rest, BOUNDS);

    expect(state.offset.y).toBe(BOUNDS.height - GLOW_EDGE_MARGIN - rest.y);
    expect(state.velocity.y).toBeCloseTo(-5 * GLOW_BOUNCE);
  });

  it("leaves an orb inside the margins alone", () => {
    const state = makeState(10, -10, 2, 2);

    bounceOffEdges(state, rest, BOUNDS);

    expect(state).toEqual(makeState(10, -10, 2, 2));
  });
});

describe("stepOrbPhysics", () => {
  it("moves orbs by their velocity each frame", () => {
    const states = [makeState(0, 0, 5, 0)];

    // random() = 0.5 makes the wander jitter exactly zero.
    stepOrbPhysics(
      [makeOrb(300, 200)],
      states,
      BOUNDS,
      { x: 0, y: 0, active: false },
      constantRandom(0.5)
    );

    expect(states[0].offset.x).toBeGreaterThan(4);
    expect(states[0].offset.y).toBe(0);
  });

  it("keeps every orb inside the panel however hard it is flung", () => {
    const states = [makeState(0, 0, 500, 500)];

    for (let frame = 0; frame < 50; frame++) {
      stepOrbPhysics(
        [makeOrb(300, 200)],
        states,
        BOUNDS,
        { x: 0, y: 0, active: false },
        constantRandom(0.5)
      );
      const centerX = 300 + states[0].offset.x;
      const centerY = 200 + states[0].offset.y;
      expect(centerX).toBeGreaterThanOrEqual(GLOW_EDGE_MARGIN);
      expect(centerX).toBeLessThanOrEqual(BOUNDS.width - GLOW_EDGE_MARGIN);
      expect(centerY).toBeGreaterThanOrEqual(GLOW_EDGE_MARGIN);
      expect(centerY).toBeLessThanOrEqual(BOUNDS.height - GLOW_EDGE_MARGIN);
    }
  });

  it("never lets two orbs end a frame overlapping", () => {
    const orbs = [makeOrb(250, 200), makeOrb(350, 200)];
    const states = [makeState(0, 0, 3, 0), makeState(0, 0, -3, 0)];

    stepOrbPhysics(orbs, states, BOUNDS, { x: 0, y: 0, active: false }, constantRandom(0.5));

    const distance = Math.hypot(
      350 + states[1].offset.x - (250 + states[0].offset.x),
      200 + states[1].offset.y - (200 + states[0].offset.y)
    );
    expect(distance).toBeGreaterThanOrEqual(99.999);
  });
});
