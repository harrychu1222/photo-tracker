import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useProjects(userId, isAdmin) {
  const [projects, setProjects] = useState([])
  const [finance, setFinance] = useState({}) // project_id -> { budget, markup_pct, quote_mode, quote_lump, est_* }
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
      if (error.code === '42703' || error.code === 'PGRST204') {
        throw new Error('The actual project dates need migration 13. Run supabase/migration_13_quote_dates.sql in Supabase, then reload.')
      }
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
      if (error.code === '42703' || error.code === 'PGRST204') {
        throw new Error('The actual project dates need migration 13. Run supabase/migration_13_quote_dates.sql in Supabase, then reload.')
      }
      if (error.code === '23505') throw new Error(`A project called "${clean.name}" already exists.`)
      throw error
    }
    await fetchProjects()
  }

  // fields: { quote_mode, markup_pct, budget, quote_lump, est_materials, est_equipment, est_labour,
  // est_subcontractors, est_other }. Blank means "not set". Everything is entered as paid (GST included).
  async function saveFinance(projectId, fields) {
    const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
    const row = {
      project_id: projectId,
      quote_mode: fields.quote_mode === 'lump' ? 'lump' : 'buildup',
      budget: num(fields.budget),
      markup_pct: num(fields.markup_pct) ?? 0,
      quote_lump: num(fields.quote_lump),
      est_materials: num(fields.est_materials),
      est_equipment: num(fields.est_equipment),
      est_labour: num(fields.est_labour),
      est_subcontractors: num(fields.est_subcontractors),
      est_other: num(fields.est_other),
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from('project_finance').upsert(row, { onConflict: 'project_id' })
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') {
        throw new Error('The quote set-up needs migration 13. Run supabase/migration_13_quote_dates.sql in Supabase, then reload.')
      }
      throw error
    }
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
