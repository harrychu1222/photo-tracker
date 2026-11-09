import { useEffect, useMemo, useState } from 'react'
import ProjectsList from './ProjectsList'
import ProjectDetail from './ProjectDetail'
import ProjectForm from './ProjectForm'
import ProjectSetup from './ProjectSetup'
import { useAuth } from '../../context/AuthContext'

// Switches between the projects list, one project, and the create/edit form.
export default function ProjectsView({ projectsApi, photos, suggestions, onUpdatePhoto, onDeletePhoto, selectedId, onSelect, isDesktop, openTab, onAddPhoto, onTeam }) {
  const { user, isAdmin } = useAuth()
  const { projects, projectsById, finance, loading, error, createProject, updateProject, saveFinance, deleteProject } =
    projectsApi

  const setSelectedId = onSelect
  const [mode, setMode] = useState('view') // 'view' | 'new' (questions) | 'newform' | 'edit'

  // Picking another project (or going back to the list) leaves any open form.
  useEffect(() => {
    setMode('view')
  }, [selectedId])

  const photoCounts = useMemo(() => {
    const counts = {}
    photos.forEach((p) => {
      if (p.project_id) counts[p.project_id] = (counts[p.project_id] || 0) + 1
    })
    return counts
  }, [photos])

  const selected = selectedId ? projectsById[selectedId] : null
  const canEdit = (p) => !!p && (isAdmin || p.created_by === user?.id)

  async function handleSave(fields, money) {
    if (mode !== 'edit') {
      const name = (fields.name || '').trim()
      if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`A project called "${name}" already exists.`)
      }
      const created = await createProject(fields)
      if (money) await saveFinance(created.id, money)
      setSelectedId(created.id)
    } else {
      await updateProject(selected.id, fields)
      if (money) await saveFinance(selected.id, money)
    }
    setMode('view')
  }

  async function handleDelete() {
    await deleteProject(selected.id)
    setSelectedId(null)
    setMode('view')
  }

  if (mode === 'new') {
    return (
      <ProjectSetup
        onCreate={async (fields) => {
          if (projects.some((p) => p.name.toLowerCase() === fields.name.toLowerCase())) throw new Error(`A project called "${fields.name}" already exists.`)
          return createProject(fields)
        }}
        onDone={(id) => {
          setSelectedId(id)
          setMode('view')
        }}
        onCancel={() => setMode('view')}
        onFullForm={() => setMode('newform')}
      />
    )
  }

  if (mode === 'newform') {
    return (
      <div className="mx-auto max-w-3xl md:py-4">
        <ProjectForm isAdmin={isAdmin} onSave={handleSave} onCancel={() => setMode('view')} />
      </div>
    )
  }

  if (mode === 'edit' && selected) {
    return (
      <div className="mx-auto max-w-3xl md:py-4">
      <ProjectForm
        key={selected.id}
        project={selected}
        finance={finance[selected.id]}
        isAdmin={isAdmin}
        canDelete={isAdmin}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={() => setMode('view')}
      />
      </div>
    )
  }

  if (selected) {
    return (
      <ProjectDetail
        key={`${selected.id}|${openTab || ''}`}
        initialTab={openTab}
        project={selected}
        finance={finance[selected.id]}
        isAdmin={isAdmin}
        canEdit={canEdit(selected)}
        photos={photos.filter((p) => p.project_id === selected.id)}
        onBack={() => setSelectedId(null)}
        onEdit={() => setMode('edit')}
        onUpdatePhoto={onUpdatePhoto}
        onDeletePhoto={onDeletePhoto}
        suggestions={suggestions}
        projects={projects}
        onCreateProject={createProject}
        isDesktop={isDesktop}
      />
    )
  }

  return (
    <ProjectsList
      projects={projects}
      photoCounts={photoCounts}
      finance={finance}
      loading={loading}
      error={error}
      onOpen={setSelectedId}
      onNew={() => setMode('new')}
      onAddPhoto={onAddPhoto}
      onTeam={onTeam}
    />
  )
}
