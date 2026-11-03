import { LEVELS } from './setup'

export const NO_LEVEL = '__none'

// The levels in use in a project's rooms, in house order (Basement ... Exterior).
export function levelsOf(rooms) {
  const have = new Set(rooms.map((r) => r.level).filter(Boolean))
  const out = LEVELS.map((l) => l.label).filter((l) => have.has(l))
  have.forEach((l) => out.includes(l) || out.push(l))
  return out
}

// 'all' keeps every room; NO_LEVEL keeps rooms saved without a level.
export const roomsInLevel = (rooms, level) =>
  level === 'all' || !level ? rooms : level === NO_LEVEL ? rooms.filter((r) => !r.level) : rooms.filter((r) => r.level === level)
