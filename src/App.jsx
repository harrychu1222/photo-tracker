import { useMemo, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './components/Auth/Login'
import SignUp from './components/Auth/SignUp'
import AppShell from './components/Layout/AppShell'
import Gallery from './components/Photos/Gallery'
import UploadModal from './components/Photos/UploadModal'
import ProjectsView from './components/Projects/ProjectsView'
import TeamView from './components/Team/TeamView'
import { usePhotos } from './hooks/usePhotos'
import { useProjects } from './hooks/useProjects'
import { useWork } from './context/WorkContext'
import { useMedia } from './hooks/useMedia'

export default function App() {
  const { user, loading, isAdmin, signOut } = useAuth()
  const isDesktop = useMedia('(min-width: 768px)')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [authView, setAuthView] = useState('login')
  const [showUpload, setShowUpload] = useState(false)
  const [tab, setTab] = useState('projects') // 'projects' | 'photos' | 'team'

  const { photos, loading: photosLoading, error, uploadPhotos, updatePhoto, deletePhoto } = usePhotos(user?.id)
  const projectsApi = useProjects(user?.id, isAdmin)
  const { projects, projectsById, createProject } = projectsApi

  const { roomsById } = useWork()

  // Show each photo under its project's and room's current names, so renaming either
  // renames it everywhere. Photos with no project or room record keep their own text.
  const photosWithProject = useMemo(
    () =>
      photos.map((p) => {
        const project = p.project_id ? projectsById[p.project_id] : null
        const room = p.room_id ? roomsById[p.room_id] : null
        if (!project && !room) return p
        return { ...p, location: project ? project.name : p.location, room: room ? room.name : p.room }
      }),
    [photos, projectsById, roomsById]
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

  function goTab(next) {
    setTab(next)
    if (next === 'projects') setSelectedProjectId(null)
  }

  function openProject(id) {
    setTab('projects')
    setSelectedProjectId(id)
  }

  // Photos keep a narrower column; Projects use the full width on a computer.
  const photoWidth = isDesktop ? 'mx-auto max-w-3xl bg-white min-h-screen' : 'bg-white'

  return (
    <AppShell
      isDesktop={isDesktop}
      tab={tab}
      onTab={goTab}
      isAdmin={isAdmin}
      email={user?.email}
      onSignOut={signOut}
      onAddPhoto={() => setShowUpload(true)}
      projects={projects}
      selectedId={tab === 'projects' ? selectedProjectId : null}
      onOpenProject={openProject}
    >
      {tab === 'photos' ? (
        <div className={photoWidth}>
          <Gallery
            photos={photosWithProject}
            loading={photosLoading}
            error={error}
            onUpdate={updatePhoto}
            onDelete={deletePhoto}
            projects={projects}
            onCreateProject={createProject}
          />
        </div>
      ) : tab === 'team' ? (
        <div className="mx-auto max-w-3xl">
          <TeamView />
        </div>
      ) : (
        <ProjectsView
          projectsApi={projectsApi}
          photos={photosWithProject}
          suggestions={suggestions}
          onUpdatePhoto={updatePhoto}
          onDeletePhoto={deletePhoto}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          isDesktop={isDesktop}
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
    </AppShell>
  )
}
