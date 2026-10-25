import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useProjects(userId, isAdmin) {
  const [projects, setProjects] = useState([])
  const [finance, setFinance] = useState({}) // project_id -> { budget, markup_pct, gst_enabled }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async () => {
    if (!userId) return
    setError(null)

    const { data, error } = await supabase.from('projects').select('*')
    if (error) {
      // Most likely cause: migration_4_projects_roles.sql hasn't been run yet.
      setProjects([])
      setError(
        error.code === 'PGRST205' || error.code === '42P01'
          ? 'Projects are not set up yet. Run supabase/migration_4_projects_roles.sql in Supabase, then reload.'
          : error.message
      )
      setLoading(false)
      return
    }
    setProjects([...data].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))

    if (isAdmin) {
      const { data: fin } = await supabase.from('project_finance').select('*')
      setFinance(Object.fromEntries((fin || []).map((f) => [f.project_id, f])))
    } else {
      setFinance({})
    }
    setLoading(false)
  }, [userId, isAdmin])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])

  // Creates a project, or returns the existing one if that name is already taken
  // (names are unique ignoring capitalisation).
  async function createProject(fields) {
    const name = (fields.name || '').trim()
    if (!name) throw new Error('Give the project a name.')

    const existing = projects.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...fields, name, created_by: userId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        await fetchProjects()
        const { data: again } = await supabase.from('projects').select('*').ilike('name', name).maybeSingle()
        if (again) return again
      }
      throw error
    }
    await fetchProjects()
    return data
  }

  async function updateProject(id, patch) {
    const clean = { ...patch }
    if (typeof clean.name === 'string') clean.name = clean.name.trim()
    const { error } = await supabase.from('projects').update(clean).eq('id', id)
    if (error) {
      if (error.code === '23505') throw new Error(`A project called "${clean.name}" already exists.`)
      throw error
    }
    await fetchProjects()
  }

  async function saveFinance(projectId, { budget, markup_pct, gst_enabled }) {
    const { error } = await supabase.from('project_finance').upsert(
      {
        project_id: projectId,
        budget: budget === '' || budget == null ? null : Number(budget),
        markup_pct: markup_pct === '' || markup_pct == null ? 0 : Number(markup_pct),
        gst_enabled: !!gst_enabled,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'project_id' }
    )
    if (error) throw error
    await fetchProjects()
  }

  async function deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
    await fetchProjects()
  }

  return {
    projects,
    projectsById,
    finance,
    loading,
    error,
    createProject,
    updateProject,
    saveFinance,
    deleteProject,
    refresh: fetchProjects
  }
}
