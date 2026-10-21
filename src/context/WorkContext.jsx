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
  const { user } = useAuth()
  const userId = user?.id
  const [rooms, setRooms] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setRooms([])
      setTasks([])
      return
    }
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
  }, [userId])

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

  const value = {
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
