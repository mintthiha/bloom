// Physics for the login showcase's floating orbs: cursor repulsion with momentum, elastic
// orb-vs-orb collisions, and edge bounce. Pure apart from mutating the orb states it is given;
// randomness is injected so the behavior can be tested deterministically.

export const GLOW_INFLUENCE_RADIUS = 200; // cursor distance at which repulsion kicks in — smaller = get closer first
export const GLOW_PUSH_ACCEL = 2.4; // peak shove strength when the cursor is right next to a glow
export const GLOW_FRICTION = 0.965; // velocity retained each frame — higher = coasts/decelerates more gradually
export const GLOW_MAX_SPEED = 30; // cap so a close cursor can't fling one uncontrollably fast
export const GLOW_AMBIENT_SPEED = 0.4; // baseline drift speed — orbs float forever and never fully stop
export const GLOW_AMBIENT_JITTER = 0.03; // tiny random nudge each frame so the drift wanders organically
export const GLOW_EDGE_MARGIN = 20; // keep each glow's center at least this far inside the panel
export const GLOW_BOUNCE = 0.6; // energy kept after bouncing off an edge or another orb (0 = dead stop, 1 = perfect)

export type Vector = { x: number; y: number };

/** Where an orb sits relative to its resting center, and how fast it is moving. */
export type OrbState = { offset: Vector; velocity: Vector };

/** The panel's size; a DOMRect satisfies it. */
export type PanelBounds = { width: number; height: number };

/** What the physics needs to know about an orb: its collision radius and resting center. */
export type OrbBody = { radius: number; rest: (bounds: PanelBounds) => Vector };

export type Cursor = Vector & { active: boolean };

/** Returns a number in [0, 1), like Math.random. */
export type RandomSource = () => number;

/** Creates resting, motionless states for `count` orbs. */
export function createOrbStates(count: number): OrbState[] {
  return Array.from({ length: count }, () => ({
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
  }));
}

/** Points `velocity` in a random direction at the ambient drift speed. */
function driftInRandomDirection(velocity: Vector, random: RandomSource): void {
  const angle = random() * Math.PI * 2;
  velocity.x = Math.cos(angle) * GLOW_AMBIENT_SPEED;
  velocity.y = Math.sin(angle) * GLOW_AMBIENT_SPEED;
}

/** Places each orb at a random spot inside the panel margins, drifting in a random direction. */
export function spawnOrbs(
  orbs: OrbBody[],
  states: OrbState[],
  bounds: PanelBounds,
  random: RandomSource
): void {
  orbs.forEach((orb, index) => {
    const rest = orb.rest(bounds);
    const spawnX = GLOW_EDGE_MARGIN + random() * (bounds.width - 2 * GLOW_EDGE_MARGIN);
    const spawnY = GLOW_EDGE_MARGIN + random() * (bounds.height - 2 * GLOW_EDGE_MARGIN);
    states[index].offset.x = spawnX - rest.x;
    states[index].offset.y = spawnY - rest.y;
    driftInRandomDirection(states[index].velocity, random);
  });
}

/**
 * Pushes an orb away from a nearby cursor. Quadratic falloff: the closer the cursor, the sharply
 * faster it accelerates away; beyond GLOW_INFLUENCE_RADIUS there is no effect.
 */
export function applyCursorRepulsion(state: OrbState, center: Vector, cursor: Cursor): void {
  if (!cursor.active) return;
  const deltaX = center.x - cursor.x;
  const deltaY = center.y - cursor.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  if (distance >= GLOW_INFLUENCE_RADIUS) return;
  const proximity = 1 - distance / GLOW_INFLUENCE_RADIUS;
  const push = proximity * proximity * GLOW_PUSH_ACCEL;
  state.velocity.x += (deltaX / distance) * push;
  state.velocity.y += (deltaY / distance) * push;
}

/**
 * Keeps speed within [ambient floor, max]: an orb never flings uncontrollably and never fully
 * stops. A practically motionless orb is sent off in a random direction.
 */
export function clampSpeed(velocity: Vector, random: RandomSource): void {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > GLOW_MAX_SPEED) {
    velocity.x = (velocity.x / speed) * GLOW_MAX_SPEED;
    velocity.y = (velocity.y / speed) * GLOW_MAX_SPEED;
  } else if (speed < GLOW_AMBIENT_SPEED) {
    if (speed < 0.0001) {
      driftInRandomDirection(velocity, random);
    } else {
      velocity.x = (velocity.x / speed) * GLOW_AMBIENT_SPEED;
      velocity.y = (velocity.y / speed) * GLOW_AMBIENT_SPEED;
    }
  }
}

/**
 * Resolves an overlap between two equal-mass orbs: separates them evenly, then exchanges velocity
 * along the collision normal if they are moving toward each other.
 */
export function resolveOrbCollision(
  firstOrb: OrbBody,
  firstState: OrbState,
  secondOrb: OrbBody,
  secondState: OrbState,
  bounds: PanelBounds
): void {
  const firstRest = firstOrb.rest(bounds);
  const secondRest = secondOrb.rest(bounds);
  const deltaX = secondRest.x + secondState.offset.x - (firstRest.x + firstState.offset.x);
  const deltaY = secondRest.y + secondState.offset.y - (firstRest.y + firstState.offset.y);
  const distance = Math.hypot(deltaX, deltaY) || 0.0001;
  const minimumDistance = firstOrb.radius + secondOrb.radius;
  if (distance >= minimumDistance) return;

  const normalX = deltaX / distance;
  const normalY = deltaY / distance;

  const overlap = (minimumDistance - distance) / 2;
  firstState.offset.x -= normalX * overlap;
  firstState.offset.y -= normalY * overlap;
  secondState.offset.x += normalX * overlap;
  secondState.offset.y += normalY * overlap;

  const velocityAlongNormal =
    (secondState.velocity.x - firstState.velocity.x) * normalX +
    (secondState.velocity.y - firstState.velocity.y) * normalY;
  if (velocityAlongNormal < 0) {
    const impulse = (-(1 + GLOW_BOUNCE) * velocityAlongNormal) / 2;
    firstState.velocity.x -= impulse * normalX;
    firstState.velocity.y -= impulse * normalY;
    secondState.velocity.x += impulse * normalX;
    secondState.velocity.y += impulse * normalY;
  }
}

/** Keeps an orb's center inside the panel margins, reflecting (and damping) its velocity at an edge. */
export function bounceOffEdges(state: OrbState, rest: Vector, bounds: PanelBounds): void {
  const minimumOffsetX = GLOW_EDGE_MARGIN - rest.x;
  const maximumOffsetX = bounds.width - GLOW_EDGE_MARGIN - rest.x;
  const minimumOffsetY = GLOW_EDGE_MARGIN - rest.y;
  const maximumOffsetY = bounds.height - GLOW_EDGE_MARGIN - rest.y;

  if (state.offset.x < minimumOffsetX) {
    state.offset.x = minimumOffsetX;
    state.velocity.x = Math.abs(state.velocity.x) * GLOW_BOUNCE;
  } else if (state.offset.x > maximumOffsetX) {
    state.offset.x = maximumOffsetX;
    state.velocity.x = -Math.abs(state.velocity.x) * GLOW_BOUNCE;
  }
  if (state.offset.y < minimumOffsetY) {
    state.offset.y = minimumOffsetY;
    state.velocity.y = Math.abs(state.velocity.y) * GLOW_BOUNCE;
  } else if (state.offset.y > maximumOffsetY) {
    state.offset.y = maximumOffsetY;
    state.velocity.y = -Math.abs(state.velocity.y) * GLOW_BOUNCE;
  }
}

/**
 * Advances every orb by one animation frame: cursor repulsion, ambient wander, friction and speed
 * limits, then integrates position, resolves collisions between every pair, and bounces off edges.
 */
export function stepOrbPhysics(
  orbs: OrbBody[],
  states: OrbState[],
  bounds: PanelBounds,
  cursor: Cursor,
  random: RandomSource
): void {
  orbs.forEach((orb, index) => {
    const state = states[index];
    const rest = orb.rest(bounds);
    applyCursorRepulsion(state, { x: rest.x + state.offset.x, y: rest.y + state.offset.y }, cursor);

    // Gentle random wander so the drift never looks perfectly straight.
    state.velocity.x += (random() - 0.5) * GLOW_AMBIENT_JITTER;
    state.velocity.y += (random() - 0.5) * GLOW_AMBIENT_JITTER;

    state.velocity.x *= GLOW_FRICTION;
    state.velocity.y *= GLOW_FRICTION;
    clampSpeed(state.velocity, random);

    state.offset.x += state.velocity.x;
    state.offset.y += state.velocity.y;
  });

  for (let firstIndex = 0; firstIndex < orbs.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < orbs.length; secondIndex++) {
      resolveOrbCollision(
        orbs[firstIndex],
        states[firstIndex],
        orbs[secondIndex],
        states[secondIndex],
        bounds
      );
    }
  }

  orbs.forEach((orb, index) => bounceOffEdges(states[index], orb.rest(bounds), bounds));
}
