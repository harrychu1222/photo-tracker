import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'

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

  const refresh = useCallback(async () => {
    if (!userId) {
      setRooms([])
      setTasks([])
      setMaterials([])
      setEquipment([])
      return
    }
    refreshCosts()
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
  }, [userId, refreshCosts])

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
  const tasksById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks])
  const roomsByProject = useMemo(() => groupBy(rooms, 'project_id'), [rooms])
  const tasksByProject = useMemo(() => groupBy(tasks, 'project_id'), [tasks])

  const materialsByTask = useMemo(() => groupBy(materials, 'task_id'), [materials])
  const equipmentByTask = useMemo(() => groupBy(equipment, 'task_id'), [equipment])

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
      p_items: items.map((i) => ({ name: i.name, parent: i.parent, hours: i.hours }))
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
      .update({ name: name.trim(), quantity: Number(quantity), unit: (unit || '').trim() || null })
      .eq('id', id)
    if (error) throw error
    await setMaterialPrice(id, unitCost)
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

  const value = {
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
    tasks,
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
