import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './components/Auth/Login'
import SignUp from './components/Auth/SignUp'
import { SetNewPassword, RemovedScreen } from './components/Auth/AccountScreens'
import AppShell from './components/Layout/AppShell'
import Gallery from './components/Photos/Gallery'
import UploadModal from './components/Photos/UploadModal'
import ProjectsView from './components/Projects/ProjectsView'
import TeamView from './components/Team/TeamView'
import SearchView from './components/Search/SearchView'
import PlatformView from './components/Team/PlatformView'
import MyDay from './components/Projects/MyDay'
import { usePhotos } from './hooks/usePhotos'
import { useProjects } from './hooks/useProjects'
import { useWork } from './context/WorkContext'
import { useMedia } from './hooks/useMedia'

export default function App() {
  const { user, loading, isAdmin, signOut, company, isOwner, support, stopSupport, removed, recovering, finishRecovery, roleReady } = useAuth()
  const isDesktop = useMedia('(min-width: 768px)')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projectTab, setProjectTab] = useState(null) // which tab to open inside a project (from search)
  const [authView, setAuthView] = useState('login')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadPreset, setUploadPreset] = useState(null) // { projectId, roomId, taskId } when opened from a task
  const [tab, setTab] = useState('projects') // 'projects' | 'photos' | 'team'

  // Crew start on My Day (their tasks), not the project list. Only the first time, so it never
  // overrides where they go afterwards. Managers keep Projects.
  const crewHome = useRef(false)
  useEffect(() => {
    if (roleReady && !isAdmin && !crewHome.current) {
      crewHome.current = true
      setTab('myday')
    }
  }, [roleReady, isAdmin])

  function openUpload(preset = null) {
    setUploadPreset(preset)
    setShowUpload(true)
  }

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

  if (recovering) return <SetNewPassword onDone={finishRecovery} />
  if (removed) return <RemovedScreen onSignOut={signOut} />

  function goTab(next) {
    setTab(next)
    if (next === 'projects') setSelectedProjectId(null)
  }

  function openProject(id, inTab = null) {
    setTab('projects')
    setProjectTab(inTab)
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
      onAddPhoto={() => openUpload()}
      projects={projects}
      selectedId={tab === 'projects' ? selectedProjectId : null}
      onOpenProject={openProject}
      company={company}
      isOwner={isOwner}
      support={support}
      onStopSupport={stopSupport}
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
      ) : tab === 'search' ? (
        <SearchView projects={projects} photos={photosWithProject} onOpen={openProject} />
      ) : tab === 'myday' ? (
        <MyDay projects={projects} onOpenProject={openProject} onAddPhoto={openUpload} />
      ) : tab === 'platform' && isOwner ? (
        <div className="mx-auto max-w-3xl">
          <PlatformView />
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
          openTab={projectTab}
          onAddPhoto={() => openUpload()}
          onTeam={() => goTab('team')}
          isDesktop={isDesktop}
        />
      )}

      {showUpload && (
        <UploadModal
          preset={uploadPreset}
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
