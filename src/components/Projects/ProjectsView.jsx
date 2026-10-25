import { useMemo, useState } from 'react'
import ProjectsList from './ProjectsList'
import ProjectDetail from './ProjectDetail'
import ProjectForm from './ProjectForm'
import { useAuth } from '../../context/AuthContext'

// Switches between the projects list, one project, and the create/edit form.
export default function ProjectsView({ projectsApi, photos, suggestions, onUpdatePhoto, onDeletePhoto }) {
  const { user, isAdmin } = useAuth()
  const { projects, projectsById, finance, loading, error, createProject, updateProject, saveFinance, deleteProject } =
    projectsApi

  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('view') // 'view' | 'new' | 'edit'

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
    if (mode === 'new') {
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
    return <ProjectForm isAdmin={isAdmin} onSave={handleSave} onCancel={() => setMode('view')} />
  }

  if (mode === 'edit' && selected) {
    return (
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
    )
  }

  if (selected) {
    return (
      <ProjectDetail
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
      />
    )
  }

  return (
    <ProjectsList
      projects={projects}
      photoCounts={photoCounts}
      loading={loading}
      error={error}
      onOpen={setSelectedId}
      onNew={() => setMode('new')}
    />
  )
}
