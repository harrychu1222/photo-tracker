// Room sizes and the areas worked out from them. Sizes are stored as typed, in the room's
// unit (mm or m); everything calculated here is in metres and square metres.

const r3 = (n) => Math.round(n * 1000) / 1000
const r4 = (n) => Math.round(n * 10000) / 10000

function num(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// A typed size in metres, or null if it isn't a usable number.
function metres(v, unit) {
  const n = num(v)
  if (n == null) return null
  return unit === 'mm' ? n / 1000 : n
}

// Area in m2 of a door or window typed as width and height in the room's unit.
export function openingArea(width, height, unit) {
  const w = metres(width, unit)
  const h = metres(height, unit)
  return w == null || h == null ? null : r3(w * h)
}

// Everything worked out for one room. `openings` are that room's door / window measurements
// (each with a `value` in m2). A figure that can't be worked out yet is null.
export function roomCalc(room, openings = []) {
  const unit = room.dim_unit || 'mm'
  const openingsArea = r3(openings.reduce((sum, o) => sum + (Number(o.value) || 0), 0))
  const hasOpenings = openings.length > 0
  const out = {
    manual: !!room.manual_areas,
    floor: null,
    ceiling: null,
    wallsGross: null,
    wallsNet: null,
    perimeter: null,
    lengthWallEach: null,
    widthWallEach: null,
    openingsArea,
    hasOpenings
  }

  if (room.manual_areas) {
    out.floor = num(room.manual_floor_area)
    out.wallsGross = num(room.manual_wall_area)
    out.perimeter = num(room.manual_perimeter)
  } else {
    const l = metres(room.room_length, unit)
    const w = metres(room.room_width, unit)
    const h = metres(room.room_height, unit)
    if (l != null && w != null) {
      out.floor = r3(l * w)
      out.perimeter = r3(2 * (l + w))
    }
    if (l != null && h != null) out.lengthWallEach = r3(l * h)
    if (w != null && h != null) out.widthWallEach = r3(w * h)
    if (out.lengthWallEach != null && out.widthWallEach != null) {
      out.wallsGross = r3(2 * out.lengthWallEach + 2 * out.widthWallEach)
    }
  }

  out.ceiling = out.floor
  if (out.wallsGross != null) out.wallsNet = r3(Math.max(0, out.wallsGross - openingsArea))
  return out
}

// The figures a material quantity can be filled from: [{ key, label, value, unit }].
export function roomPickList(room, openings = []) {
  const c = roomCalc(room, openings)
  const unit = room.dim_unit || 'mm'
  const list = [
    { key: 'floor', label: 'Floor area', value: c.floor, unit: 'm²' },
    { key: 'ceiling', label: 'Ceiling area', value: c.ceiling, unit: 'm²' },
    {
      key: 'wallsGross',
      label: c.hasOpenings ? 'Wall area, before openings' : 'Wall area, all walls',
      value: c.wallsGross,
      unit: 'm²'
    },
    { key: 'wallsNet', label: 'Wall area, after openings', value: c.hasOpenings ? c.wallsNet : null, unit: 'm²' },
    { key: 'perimeter', label: 'Perimeter (skirting / cornice)', value: c.perimeter, unit: 'm' },
    { key: 'lengthWallEach', label: 'Each long wall', value: c.lengthWallEach, unit: 'm²' },
    { key: 'widthWallEach', label: 'Each short wall', value: c.widthWallEach, unit: 'm²' }
  ]
  if (!room.manual_areas) {
    const h = metres(room.room_height, unit)
    list.push({ key: 'height', label: 'Ceiling height', value: h == null ? null : r3(h), unit: 'm' })
  }
  return list.filter((x) => x.value != null)
}

// What to save when the room's unit is switched, so the same room keeps the same size.
export function convertRoomUnit(room, toUnit) {
  const from = room.dim_unit || 'mm'
  if (from === toUnit) return { dim_unit: toUnit }
  const k = from === 'mm' ? 1 / 1000 : 1000
  const conv = (v) => (num(v) == null ? null : r4(Number(v) * k))
  return {
    dim_unit: toUnit,
    room_length: conv(room.room_length),
    room_width: conv(room.room_width),
    room_height: conv(room.room_height)
  }
}

// Same for an opening's width and height.
export function convertOpeningUnit(opening, fromUnit, toUnit) {
  if (fromUnit === toUnit) return {}
  const k = fromUnit === 'mm' ? 1 / 1000 : 1000
  const conv = (v) => (num(v) == null ? null : r4(Number(v) * k))
  return { opening_width: conv(opening.opening_width), opening_height: conv(opening.opening_height) }
}

// A friendly 3 decimal places max with no trailing zeros: 12 -> "12", 33.6 -> "33.6".
export function fmtArea(v) {
  return v == null ? '—' : String(Number(Number(v).toFixed(3)))
}
