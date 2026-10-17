import { useMemo, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './components/Auth/Login'
import SignUp from './components/Auth/SignUp'
import Header from './components/Layout/Header'
import TabBar from './components/Layout/TabBar'
import Gallery from './components/Photos/Gallery'
import UploadModal from './components/Photos/UploadModal'
import ProjectsView from './components/Projects/ProjectsView'
import { usePhotos } from './hooks/usePhotos'
import { useProjects } from './hooks/useProjects'

export default function App() {
  const { user, loading, isAdmin } = useAuth()
  const [authView, setAuthView] = useState('login')
  const [showUpload, setShowUpload] = useState(false)
  const [tab, setTab] = useState('photos') // 'photos' | 'projects'

  const { photos, loading: photosLoading, error, uploadPhotos, updatePhoto, deletePhoto } = usePhotos(user?.id)
  const projectsApi = useProjects(user?.id, isAdmin)
  const { projects, projectsById, createProject } = projectsApi

  // Show each photo under its project's current name, so renaming a project
  // renames it everywhere. Photos with no project record keep their own text.
  const photosWithProject = useMemo(
    () =>
      photos.map((p) => {
        const project = p.project_id ? projectsById[p.project_id] : null
        return project ? { ...p, location: project.name } : p
      }),
    [photos, projectsById]
  )

  const suggestions = useMemo(() => {
    const uniq = (values) => Array.from(new Set(values.filter(Boolean))).sort()
    return {
      locations: uniq(photosWithProject.map((p) => p.location)),
      rooms: uniq(photosWithProject.map((p) => p.room)),
      categories: uniq(photosWithProject.map((p) => p.category))
    }
  }, [photosWithProject])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-400">Loading…</div>
  }

  if (!user) {
    return authView === 'login' ? (
      <Login onSwitchToSignUp={() => setAuthView('signup')} />
    ) : (
      <SignUp onSwitchToLogin={() => setAuthView('login')} />
    )
  }

  // Photos keep the narrow phone column; Projects gets room to breathe on a computer.
  const widthClass = tab === 'projects' ? 'max-w-5xl' : 'max-w-app'

  return (
    <div className={`mx-auto min-h-screen bg-white pb-16 ${widthClass}`}>
      <Header onAddPhoto={() => setShowUpload(true)} />

      {tab === 'photos' ? (
        <Gallery
          photos={photosWithProject}
          loading={photosLoading}
          error={error}
          onUpdate={updatePhoto}
          onDelete={deletePhoto}
          projects={projects}
          onCreateProject={createProject}
        />
      ) : (
        <ProjectsView
          projectsApi={projectsApi}
          photos={photosWithProject}
          suggestions={suggestions}
          onUpdatePhoto={updatePhoto}
          onDeletePhoto={deletePhoto}
        />
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={uploadPhotos}
          suggestions={suggestions}
          projects={projects}
          onCreateProject={createProject}
        />
      )}

      <TabBar tab={tab} onChange={setTab} widthClass={widthClass} />
    </div>
  )
}
