import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'
import { shrinkImage } from '../lib/image'
import { convertOpeningUnit, convertRoomUnit, openingArea } from '../lib/rooms'

// Rooms and tasks for every project, shared by the Projects screens and the photo
// forms (which link photos to a room and a task).
const WorkContext = createContext(null)

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

// Planned start first (undated tasks last), then the order they were added.
function sortTasks(list) {
  return [...list].sort((a, b) => {
    const as = a.planned_start || '9999-12-31'
    const bs = b.planned_start || '9999-12-31'
    if (as !== bs) return as < bs ? -1 : 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at < b.created_at ? -1 : 1
  })
}

function groupBy(list, key) {
  const out = {}
  list.forEach((item) => {
    ;(out[item[key]] ||= []).push(item)
  })
  return out
}

export function WorkProvider({ children }) {
  const { user, isAdmin } = useAuth()
  const userId = user?.id
  const [rooms, setRooms] = useState([])
  const [tasks, setTasks] = useState([])
  const [materials, setMaterials] = useState([])
  const [equipment, setEquipment] = useState([])
  const [matPrices, setMatPrices] = useState({}) // material id -> unit cost (admins only)
  const [eqPrices, setEqPrices] = useState({}) // equipment id -> cost (admins only)
  const [costsError, setCostsError] = useState(null)
  const [links, setLinks] = useState([]) // task_dependencies rows: { task_id, depends_on_id }
  const [linksReady, setLinksReady] = useState(false) // false until migration 7 is in place
  const [measurements, setMeasurements] = useState([])
  const [measurementsError, setMeasurementsError] = useState(null)
  const [expenses, setExpenses] = useState([]) // admins get everyone's; crew only their own (RLS)
  const [expensesError, setExpensesError] = useState(null)
  const [payments, setPayments] = useState([]) // admins only
  const [paymentsError, setPaymentsError] = useState(null)
  const [timeEntries, setTimeEntries] = useState([]) // admins get everyone's; crew only their own (RLS)
  const [timeError, setTimeError] = useState(null)
  const [rates, setRates] = useState({}) // user id -> hourly rate (admins only)
  const [migration12Missing, setMigration12Missing] = useState(false)
  const [workers, setWorkers] = useState([]) // people without a login (admins only)
  const [entryRates, setEntryRates] = useState({}) // time entry id -> its own hourly rate (admins only)
  const [lumps, setLumps] = useState([]) // lump sums, often subcontracted work (admins only)
  const [people, setPeople] = useState({}) // user id -> email (admins only), to show who paid
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Materials and equipment live in their own tables (migration 6). If that migration has
  // not been run yet, rooms and tasks keep working and only these lists stay empty.
  const refreshCosts = useCallback(async () => {
    if (!userId) {
      setMaterials([])
      setEquipment([])
      setMatPrices({})
      setEqPrices({})
      return
    }
    const [m, e, mp, ep] = await Promise.all([
      supabase.from('task_materials').select('*'),
      supabase.from('task_equipment').select('*'),
      isAdmin ? supabase.from('material_prices').select('*') : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from('equipment_prices').select('*') : Promise.resolve({ data: [] })
    ])
    const err = m.error || e.error || mp.error || ep.error
    if (err) {
      setMaterials([])
      setEquipment([])
      setMatPrices({})
      setEqPrices({})
      setCostsError(
        err.code === 'PGRST205' || err.code === '42P01'
          ? 'Materials and equipment are not set up yet. Run supabase/migration_6_materials_equipment_team.sql in Supabase, then reload.'
          : err.message
      )
      return
    }
    setCostsError(null)
    const order = (a, b) => (a.sort_order - b.sort_order) || (a.created_at < b.created_at ? -1 : 1)
    setMaterials([...m.data].sort(order))
    setEquipment([...e.data].sort(order))
    setMatPrices(Object.fromEntries((mp.data || []).map((r) => [r.material_id, Number(r.unit_cost)])))
    setEqPrices(Object.fromEntries((ep.data || []).map((r) => [r.equipment_id, Number(r.cost)])))
  }, [userId, isAdmin])

  // Stage 4a tables (migration 7). Until it is run, tasks fall back to their old single
  // "waiting on" link and measurements stay empty.
  const refreshExtras = useCallback(async () => {
    if (!userId) {
      setLinks([])
      setLinksReady(false)
      setMeasurements([])
      return
    }
    const [d, m] = await Promise.all([
      supabase.from('task_dependencies').select('*'),
      supabase.from('measurements').select('*')
    ])
    if (d.error) {
      setLinks([])
      setLinksReady(false)
    } else {
      setLinks(d.data)
      setLinksReady(true)
    }
    if (m.error) {
      setMeasurements([])
      setMeasurementsError(
        m.error.code === 'PGRST205' || m.error.code === '42P01'
          ? 'Measurements are not set up yet. Run supabase/migration_7_dependencies_status_measurements.sql in Supabase, then reload.'
          : m.error.message
      )
    } else {
      setMeasurementsError(null)
      setMeasurements(
        [...m.data].sort((a, b) => (a.sort_order - b.sort_order) || (a.created_at < b.created_at ? -1 : 1))
      )
    }
  }, [userId])

  // Expenses (migration 9). Until it is run the rest of the app keeps working.
  const refreshExpenses = useCallback(async () => {
    if (!userId) {
      setExpenses([])
      return
    }
    const [x, p] = await Promise.all([
      supabase.from('expenses').select('*'),
      isAdmin ? supabase.from('profiles').select('id, email') : Promise.resolve({ data: [] })
    ])
    if (x.error) {
      setExpenses([])
      setExpensesError(
        x.error.code === 'PGRST205' || x.error.code === '42P01'
          ? 'Expenses are not set up yet. Run supabase/migration_9_expenses.sql in Supabase, then reload.'
          : x.error.message
      )
      return
    }
    setExpensesError(null)
    setExpenses(x.data)
    setPeople(Object.fromEntries((p.data || []).map((r) => [r.id, r.email])))
  }, [userId, isAdmin])

  // Payments received (migration 10). Admins only; crew never load them.
  const refreshPayments = useCallback(async () => {
    if (!userId || !isAdmin) {
      setPayments([])
      setPaymentsError(null)
      return
    }
    const { data, error } = await supabase.from('payments').select('*')
    if (error) {
      setPayments([])
      setPaymentsError(
        error.code === 'PGRST205' || error.code === '42P01'
          ? 'Payments are not set up yet. Run supabase/migration_10_payments.sql in Supabase, then reload.'
          : error.message
      )
      return
    }
    setPaymentsError(null)
    setPayments(data)
  }, [userId, isAdmin])

  // Hours worked and hourly rates (migrations 11 and 12). The hours load for everyone (crew see
  // their own); rates, extra people and lump sums load for admins only.
  const refreshTime = useCallback(async () => {
    if (!userId) {
      setTimeEntries([])
      setRates({})
      setWorkers([])
      setEntryRates({})
      setLumps([])
      return
    }
    const none = Promise.resolve({ data: [] })
    const [t, r, w, er, lu] = await Promise.all([
      supabase.from('time_entries').select('*'),
      isAdmin ? supabase.from('person_rates').select('*') : none,
      isAdmin ? supabase.from('crew_members').select('*') : none,
      isAdmin ? supabase.from('time_entry_rates').select('*') : none,
      isAdmin ? supabase.from('labour_lumps').select('*') : none
    ])
    if (t.error) {
      setTimeEntries([])
      setTimeError(
        t.error.code === 'PGRST205' || t.error.code === '42P01'
          ? 'Hours are not set up yet. Run supabase/migration_11_time_labour.sql in Supabase, then reload.'
          : t.error.message
      )
      return
    }
    setTimeError(null)
    setTimeEntries(t.data)
    setRates(Object.fromEntries((r.data || []).map((x) => [x.user_id, Number(x.hourly_rate)])))
    // Migration 12 may not be run yet: its tables then just stay empty and a message explains.
    const missing12 = [w, er, lu].some((q) => q.error && (q.error.code === 'PGRST205' || q.error.code === '42P01'))
    setMigration12Missing(missing12)
    setWorkers(w.error ? [] : [...(w.data || [])].sort(byName))
    setEntryRates(er.error ? {} : Object.fromEntries((er.data || []).map((x) => [x.entry_id, Number(x.hourly_rate)])))
    setLumps(lu.error ? [] : lu.data || [])
  }, [userId, isAdmin])

  const refresh = useCallback(async () => {
    if (!userId) {
      setRooms([])
      setTasks([])
      setMaterials([])
      setEquipment([])
      setLinks([])
      setMeasurements([])
      return
    }
    refreshCosts()
    refreshExtras()
    refreshExpenses()
    refreshPayments()
    refreshTime()
    const [r, t] = await Promise.all([
      supabase.from('project_rooms').select('*'),
      supabase.from('tasks').select('*')
    ])
    const err = r.error || t.error
    if (err) {
      setRooms([])
      setTasks([])
      // Most likely cause: migration_5_rooms_tasks.sql hasn't been run yet.
      setError(
        err.code === 'PGRST205' || err.code === '42P01'
          ? 'Rooms and tasks are not set up yet. Run supabase/migration_5_rooms_tasks.sql in Supabase, then reload.'
          : err.message
      )
      setLoading(false)
      return
    }
    setError(null)
    setRooms([...r.data].sort(byName))
    setTasks(sortTasks(t.data))
    setLoading(false)
  }, [userId, refreshCosts, refreshExtras, refreshExpenses, refreshPayments, refreshTime])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Pick up teammates' changes when the app comes back to the front.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const roomsById = useMemo(() => Object.fromEntries(rooms.map((r) => [r.id, r])), [rooms])
  // Every task carries `blocked_by_ids`: the tasks it waits on. Before migration 7 that is just
  // the old single link.
  const tasksFull = useMemo(() => {
    const byTask = {}
    links.forEach((l) => {
      ;(byTask[l.task_id] ||= []).push(l.depends_on_id)
    })
    return tasks.map((t) => ({
      ...t,
      blocked_by_ids: linksReady ? byTask[t.id] || [] : t.blocked_by ? [t.blocked_by] : []
    }))
  }, [tasks, links, linksReady])
  const tasksById = useMemo(() => Object.fromEntries(tasksFull.map((t) => [t.id, t])), [tasksFull])
  const roomsByProject = useMemo(() => groupBy(rooms, 'project_id'), [rooms])
  const tasksByProject = useMemo(() => groupBy(tasksFull, 'project_id'), [tasksFull])

  const materialsByTask = useMemo(() => groupBy(materials, 'task_id'), [materials])
  const measurementsByProject = useMemo(() => groupBy(measurements, 'project_id'), [measurements])
  const equipmentByTask = useMemo(() => groupBy(equipment, 'task_id'), [equipment])
  const expensesByProject = useMemo(() => groupBy(expenses, 'project_id'), [expenses])

  // Creates a room, or returns the existing one if that name is already used in the
  // project (names are unique per project, ignoring capitalisation).
  async function createRoom(projectId, rawName) {
    const name = (rawName || '').trim()
    if (!name) throw new Error('Type a room name first.')
    const existing = rooms.find((r) => r.project_id === projectId && r.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing

    const { data, error } = await supabase
      .from('project_rooms')
      .insert({ project_id: projectId, name, created_by: userId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // Someone else just added the same room — use theirs.
        const { data: all } = await supabase.from('project_rooms').select('*').eq('project_id', projectId)
        const again = (all || []).find((r) => r.name.toLowerCase() === name.toLowerCase())
        await refresh()
        if (again) return again
      }
      throw error
    }
    await refresh()
    return data
  }

  async function renameRoom(id, rawName) {
    const name = (rawName || '').trim()
    if (!name) throw new Error('A room needs a name.')
    const { error } = await supabase.from('project_rooms').update({ name }).eq('id', id)
    if (error) {
      if (error.code === '23505') throw new Error(`There is already a room called "${name}" in this project.`)
      throw error
    }
    await refresh()
  }

  // The database only lets admins, or whoever created a row, delete it. For anyone else it
  // reports success but removes nothing, so ask for the deleted rows back and say so.
  async function deleteRoom(id) {
    const { data, error } = await supabase.from('project_rooms').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this room can delete it.')
    await refresh()
  }

  // Replace the set of tasks `taskId` waits on. Needs migration 7.
  async function setTaskBlockers(taskId, blockerIds) {
    if (!linksReady) {
      if (!blockerIds.length) return
      throw new Error('Waiting on several tasks needs migration 7. Run supabase/migration_7_dependencies_status_measurements.sql in Supabase, then reload.')
    }
    const current = links.filter((l) => l.task_id === taskId).map((l) => l.depends_on_id)
    const wanted = [...new Set(blockerIds)]
    const toAdd = wanted.filter((id) => !current.includes(id))
    const toRemove = current.filter((id) => !wanted.includes(id))
    for (const id of toRemove) {
      const { error } = await supabase.from('task_dependencies').delete().eq('task_id', taskId).eq('depends_on_id', id)
      if (error) throw error
    }
    for (const id of toAdd) {
      const { error } = await supabase.from('task_dependencies').insert({ task_id: taskId, depends_on_id: id })
      if (error) throw error
    }
    await refreshExtras()
  }

  async function createTask(fields) {
    const siblings = tasksByProject[fields.project_id] || []
    const sort_order = siblings.reduce((max, t) => Math.max(max, t.sort_order || 0), 0) + 1
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...fields, sort_order, created_by: userId })
      .select()
      .single()
    if (error) throw error
    await refresh()
    return data
  }

  async function updateTask(id, patch) {
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
    if (error) throw error
    await refresh()
  }

  async function deleteTask(id) {
    const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this task can delete it.')
    await refresh()
  }

  // ---------- Bulk add and copy (done in the database, all or nothing) ----------

  // items: [{ name, parent (index of an earlier item or null), hours }]. roomIds: [] = no room.
  async function bulkAddTasks(projectId, roomIds, items) {
    const { data, error } = await supabase.rpc('bulk_add_tasks', {
      p_project: projectId,
      p_room_ids: roomIds,
      p_items: items.map((i) => ({ name: i.name, parents: i.parents || [], hours: i.hours }))
    })
    if (error) throw error
    await refresh()
    return data
  }

  async function copyTasks(taskIds, roomIds) {
    const { data, error } = await supabase.rpc('copy_tasks', { p_task_ids: taskIds, p_room_ids: roomIds })
    if (error) throw error
    await refresh()
    return data
  }

  // ---------- Materials and equipment ----------

  const hasValue = (v) => v !== '' && v != null && !Number.isNaN(Number(v))

  async function setMaterialPrice(materialId, unitCost) {
    if (!isAdmin) return
    if (hasValue(unitCost)) {
      const { error } = await supabase
        .from('material_prices')
        .upsert({ material_id: materialId, unit_cost: Number(unitCost) })
      if (error) throw error
    } else {
      const { error } = await supabase.from('material_prices').delete().eq('material_id', materialId)
      if (error) throw error
    }
  }

  async function setEquipmentPrice(equipmentId, cost) {
    if (!isAdmin) return
    if (hasValue(cost)) {
      const { error } = await supabase
        .from('equipment_prices')
        .upsert({ equipment_id: equipmentId, cost: Number(cost) })
      if (error) throw error
    } else {
      const { error } = await supabase.from('equipment_prices').delete().eq('equipment_id', equipmentId)
      if (error) throw error
    }
  }

  function checkMaterial({ name, quantity }) {
    if (!(name || '').trim()) throw new Error('Give the material a name.')
    if (quantity === '' || Number.isNaN(Number(quantity)) || Number(quantity) < 0) {
      throw new Error('Quantity must be a number, zero or more.')
    }
  }

  async function addMaterial(taskId, { name, quantity, unit, unitCost }) {
    checkMaterial({ name, quantity })
    const sort_order = (materialsByTask[taskId] || []).reduce((max, m) => Math.max(max, m.sort_order || 0), 0) + 1
    const { data, error } = await supabase
      .from('task_materials')
      .insert({
        task_id: taskId,
        name: name.trim(),
        quantity: Number(quantity),
        unit: (unit || '').trim() || null,
        sort_order,
        created_by: userId
      })
      .select()
      .single()
    if (error) throw error
    await setMaterialPrice(data.id, unitCost)
    await refreshCosts()
  }

  async function updateMaterial(id, { name, quantity, unit, unitCost }) {
    checkMaterial({ name, quantity })
    const { error } = await supabase
      .from('task_materials')
      .update({ name: name.trim(), quantity: Number(quantity), unit: (unit || '').trim() || null, check_qty: false })
      .eq('id', id)
    if (error) throw error
    await setMaterialPrice(id, unitCost)
    await refreshCosts()
  }

  async function setMaterialStatus(id, patch) {
    const { error } = await supabase.from('task_materials').update(patch).eq('id', id)
    if (error) {
      throw error.code === '42703' || error.code === 'PGRST204'
        ? new Error('Material status and dates need migrations 7 and 8. Run supabase/migration_7_dependencies_status_measurements.sql and supabase/migration_8_room_sizes_dates.sql in Supabase, then reload.')
        : error
    }
    await refreshCosts()
  }

  async function confirmMaterialQty(id) {
    const { error } = await supabase.from('task_materials').update({ check_qty: false }).eq('id', id)
    if (error) throw error
    await refreshCosts()
  }

  async function deleteMaterial(id) {
    const { data, error } = await supabase.from('task_materials').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this material can delete it.')
    await refreshCosts()
  }

  async function addEquipment(taskId, { name, kind, cost }) {
    if (!(name || '').trim()) throw new Error('Give the item a name.')
    const sort_order = (equipmentByTask[taskId] || []).reduce((max, e) => Math.max(max, e.sort_order || 0), 0) + 1
    const { data, error } = await supabase
      .from('task_equipment')
      .insert({ task_id: taskId, name: name.trim(), kind, sort_order, created_by: userId })
      .select()
      .single()
    if (error) throw error
    await setEquipmentPrice(data.id, kind === 'own' ? null : cost)
    await refreshCosts()
  }

  async function updateEquipment(id, { name, kind, ready, cost }) {
    const patch = {}
    if (name !== undefined) {
      if (!name.trim()) throw new Error('Give the item a name.')
      patch.name = name.trim()
    }
    if (kind !== undefined) patch.kind = kind
    if (ready !== undefined) patch.ready = ready
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('task_equipment').update(patch).eq('id', id)
      if (error) throw error
    }
    if (kind === 'own') await setEquipmentPrice(id, null)
    else if (cost !== undefined) await setEquipmentPrice(id, cost)
    await refreshCosts()
  }

  async function deleteEquipment(id) {
    const { data, error } = await supabase.from('task_equipment').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this item can delete it.')
    await refreshCosts()
  }

  // ---------- Measurements ----------

  const needsMigration8 = (error) =>
    error && (error.code === '42703' || error.code === 'PGRST204')
      ? new Error('Room sizes and openings need migration 8. Run supabase/migration_8_room_sizes_dates.sql in Supabase, then reload.')
      : error

  // Builds the saved fields. A door / window is typed as width and height in its room's unit;
  // what is stored as its value is the area in m2.
  function measurementFields({ roomId, label, value, unit, note, isOpening, width, height }) {
    if (!(label || '').trim()) throw new Error('Give the measurement a label, e.g. Vanity width.')
    const fields = {
      room_id: roomId || null,
      label: label.trim(),
      note: (note || '').trim() || null,
      is_opening: !!isOpening
    }
    if (isOpening) {
      if (!roomId) throw new Error('Pick the room this door or window is in.')
      const roomUnit = roomsById[roomId]?.dim_unit || 'mm'
      const area = openingArea(width, height, roomUnit)
      if (area == null) throw new Error('Type the width and height, as numbers of zero or more.')
      return { ...fields, value: area, unit: 'm²', opening_width: Number(width), opening_height: Number(height) }
    }
    if (value === '' || value == null || Number.isNaN(Number(value)) || Number(value) < 0) {
      throw new Error('The value must be a number, zero or more.')
    }
    return {
      ...fields,
      value: Number(value),
      unit: (unit || '').trim() || null,
      opening_width: null,
      opening_height: null
    }
  }

  async function addMeasurement(projectId, input) {
    const fields = measurementFields(input)
    const sort_order =
      (measurementsByProject[projectId] || []).reduce((max, m) => Math.max(max, m.sort_order || 0), 0) + 1
    const { error } = await supabase
      .from('measurements')
      .insert({ ...fields, project_id: projectId, sort_order, created_by: userId })
    if (error) throw needsMigration8(error)
    await refreshExtras()
  }

  async function updateMeasurement(id, input) {
    const fields = measurementFields(input)
    const { error } = await supabase.from('measurements').update(fields).eq('id', id)
    if (error) throw needsMigration8(error)
    await refreshExtras()
  }

  // Save a room's length / width / height (or manual areas). `patch` uses the column names.
  async function updateRoomSize(roomId, patch) {
    const { error } = await supabase.from('project_rooms').update(patch).eq('id', roomId)
    if (error) throw needsMigration8(error)
    await refresh()
  }

  // Switch a room between mm and m, converting its sizes and its openings so nothing changes.
  async function setRoomUnit(roomId, toUnit) {
    const room = roomsById[roomId]
    if (!room) return
    const from = room.dim_unit || 'mm'
    if (from === toUnit) return
    await updateRoomSize(roomId, convertRoomUnit(room, toUnit))
    const openings = measurements.filter((m) => m.room_id === roomId && m.is_opening)
    for (const o of openings) {
      const { error } = await supabase.from('measurements').update(convertOpeningUnit(o, from, toUnit)).eq('id', o.id)
      if (error) throw needsMigration8(error)
    }
    await refreshExtras()
  }

  async function deleteMeasurement(id) {
    const { data, error } = await supabase.from('measurements').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this measurement can delete it.')
    await refreshExtras()
  }

  const expenseFields = (f) => ({
    expense_date: f.expense_date,
    supplier: f.supplier?.trim() || null,
    description: f.description.trim(),
    category: f.category,
    amount_ex_gst: f.amount_ex_gst,
    material_id: f.material_id || null,
    receipt_path: f.receipt_path || null
  })

  // Upload a receipt photo into this person's own folder of the private receipts bucket.
  async function uploadReceipt(file) {
    if (!userId) throw new Error('Not signed in')
    const body = await shrinkImage(file)
    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from('receipts').upload(path, body, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    return path
  }

  async function receiptUrl(path) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
    if (error) throw error
    return data?.signedUrl || null
  }

  async function removeReceipt(path) {
    if (path) await supabase.storage.from('receipts').remove([path])
  }

  async function addExpense(projectId, fields) {
    const { error } = await supabase
      .from('expenses')
      .insert({ project_id: projectId, created_by: userId, ...expenseFields(fields) })
    if (error) throw error
    await refreshExpenses()
  }

  async function updateExpense(id, fields) {
    const { data, error } = await supabase.from('expenses').update(expenseFields(fields)).eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this expense can change it.')
    await refreshExpenses()
  }

  async function deleteExpense(expense) {
    const { data, error } = await supabase.from('expenses').delete().eq('id', expense.id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who added this expense can delete it.')
    await removeReceipt(expense.receipt_path)
    await refreshExpenses()
  }

  const paymentFields = (f) => ({
    received_on: f.received_on,
    description: f.description.trim() || 'Payment',
    amount_ex_gst: f.amount_ex_gst
  })

  async function addPayment(projectId, fields) {
    const { error } = await supabase.from('payments').insert({ project_id: projectId, created_by: userId, ...paymentFields(fields) })
    if (error) throw error
    await refreshPayments()
  }

  async function updatePayment(id, fields) {
    const { data, error } = await supabase.from('payments').update(paymentFields(fields)).eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin can change payments.')
    await refreshPayments()
  }

  async function deletePayment(id) {
    const { data, error } = await supabase.from('payments').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin can delete payments.')
    await refreshPayments()
  }

  const paymentsByProject = groupBy(payments, 'project_id')
  const timeByProject = groupBy(timeEntries, 'project_id')

  const timeFields = (f) => ({
    user_id: f.user_id || null,
    worker_id: f.worker_id || null,
    task_id: f.task_id || null,
    work_date: f.work_date,
    hours: f.hours,
    note: f.note?.trim() || null
  })

  const needs12 = (error) =>
    error?.code === 'PGRST205' || error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST204'
      ? new Error('This needs migration 12. Run supabase/migration_12_workers_rates_lumps.sql in Supabase, then reload.')
      : error

  // Find a person without a login by name (ignoring capitalisation), or create them.
  async function ensureWorker(rawName) {
    const name = (rawName || '').trim().replace(/\s+/g, ' ')
    if (!name) throw new Error('Type the person\'s name.')
    const existing = workers.find((w) => w.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing
    const { data, error } = await supabase.from('crew_members').insert({ name, created_by: userId }).select().single()
    if (error) throw needs12(error)
    return data
  }

  // fields: user_id | worker_id | newWorkerName, task_id, work_date, hours, note, and (admins) rate:
  // a one-off hourly rate for this entry ('' = use the person's usual rate).
  async function addTime(projectId, fields) {
    let workerId = fields.worker_id
    if (fields.newWorkerName) workerId = (await ensureWorker(fields.newWorkerName)).id
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ project_id: projectId, created_by: userId, ...timeFields({ ...fields, worker_id: workerId, user_id: workerId ? null : fields.user_id }) })
      .select('id')
      .single()
    if (error) throw needs12(error)
    if (isAdmin && fields.rate !== undefined) await setEntryRate(data.id, fields.rate, false)
    await refreshTime()
  }

  async function updateTime(id, fields) {
    let workerId = fields.worker_id
    if (fields.newWorkerName) workerId = (await ensureWorker(fields.newWorkerName)).id
    const { data, error } = await supabase
      .from('time_entries')
      .update(timeFields({ ...fields, worker_id: workerId, user_id: workerId ? null : fields.user_id }))
      .eq('id', id)
      .select('id')
    if (error) throw needs12(error)
    if (!data?.length) throw new Error('Only an admin or the person who worked these hours can change them.')
    if (isAdmin && fields.rate !== undefined) await setEntryRate(id, fields.rate, false)
    await refreshTime()
  }

  async function deleteTime(id) {
    const { data, error } = await supabase.from('time_entries').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only an admin or the person who worked these hours can delete them.')
    await refreshTime()
  }

  // Admins: a one-off hourly rate for one entry. Empty clears it (back to the person's usual rate).
  async function setEntryRate(entryId, rate, refresh = true) {
    if (rate === '' || rate == null) {
      const { error } = await supabase.from('time_entry_rates').delete().eq('entry_id', entryId)
      if (error) throw needs12(error)
    } else {
      const { error } = await supabase.from('time_entry_rates').upsert({ entry_id: entryId, hourly_rate: Number(rate) }, { onConflict: 'entry_id' })
      if (error) throw needs12(error)
    }
    if (refresh) await refreshTime()
  }

  // Admins: set a person's usual hourly rate , or clear it with an empty value.
  // kind is 'user' (has a login) or 'worker' (typed in by name).
  async function saveRate(personId, rate, kind = 'user') {
    const value = rate === '' || rate == null ? null : Number(rate)
    if (kind === 'worker') {
      const { error } = await supabase.from('crew_members').update({ hourly_rate: value }).eq('id', personId)
      if (error) throw needs12(error)
    } else if (value == null) {
      const { error } = await supabase.from('person_rates').delete().eq('user_id', personId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('person_rates')
        .upsert({ user_id: personId, hourly_rate: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
    }
    await refreshTime()
  }

  const lumpFields = (f) => ({
    task_id: f.task_id || null,
    description: f.description.trim(),
    amount_ex_gst: f.amount_ex_gst,
    paid_on: f.paid_on,
    replaces_hours: !!f.task_id && !!f.replaces_hours
  })

  async function addLump(projectId, fields) {
    const { error } = await supabase.from('labour_lumps').insert({ project_id: projectId, created_by: userId, ...lumpFields(fields) })
    if (error) throw needs12(error)
    await refreshTime()
  }

  async function updateLump(id, fields) {
    const { data, error } = await supabase.from('labour_lumps').update(lumpFields(fields)).eq('id', id).select('id')
    if (error) throw needs12(error)
    if (!data?.length) throw new Error('Only an admin can change lump sums.')
    await refreshTime()
  }

  async function deleteLump(id) {
    const { data, error } = await supabase.from('labour_lumps').delete().eq('id', id).select('id')
    if (error) throw needs12(error)
    if (!data?.length) throw new Error('Only an admin can delete lump sums.')
    await refreshTime()
  }

  const rateBook = useMemo(
    () => ({
      user: rates,
      worker: Object.fromEntries(workers.filter((w) => w.hourly_rate != null).map((w) => [w.id, Number(w.hourly_rate)])),
      entry: entryRates
    }),
    [rates, workers, entryRates]
  )
  const lumpsByProject = groupBy(lumps, 'project_id')

  const value = {
    timeEntries,
    timeByProject,
    timeError,
    rates,
    rateBook,
    workers,
    entryRates,
    lumps,
    lumpsByProject,
    migration12Missing,
    addLump,
    updateLump,
    deleteLump,
    setEntryRate,
    addTime,
    updateTime,
    deleteTime,
    saveRate,
    payments,
    paymentsByProject,
    paymentsError,
    addPayment,
    updatePayment,
    deletePayment,
    expenses,
    expensesByProject,
    expensesError,
    people,
    addExpense,
    updateExpense,
    deleteExpense,
    uploadReceipt,
    receiptUrl,
    removeReceipt,
    measurements,
    measurementsByProject,
    measurementsError,
    linksReady,
    setTaskBlockers,
    setMaterialStatus,
    confirmMaterialQty,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
    updateRoomSize,
    setRoomUnit,
    materials,
    equipment,
    materialsByTask,
    equipmentByTask,
    matPrices,
    eqPrices,
    costsError,
    bulkAddTasks,
    copyTasks,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    rooms,
    tasks: tasksFull,
    roomsById,
    tasksById,
    roomsByProject,
    tasksByProject,
    loading,
    error,
    createRoom,
    renameRoom,
    deleteRoom,
    createTask,
    updateTask,
    deleteTask,
    refresh
  }

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>
}

export function useWork() {
  const ctx = useContext(WorkContext)
  if (!ctx) throw new Error('useWork must be used within WorkProvider')
  return ctx
}
