import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './components/Auth/Login'
import SignUp from './components/Auth/SignUp'
import Header from './components/Layout/Header'
import Gallery from './components/Photos/Gallery'
import UploadModal from './components/Photos/UploadModal'
import { usePhotos } from './hooks/usePhotos'

export default function App() {
  const { user, loading } = useAuth()
  const [authView, setAuthView] = useState('login')
  const [showUpload, setShowUpload] = useState(false)

  const { photos, loading: photosLoading, error, uploadPhotos, updatePhoto, deletePhoto } = usePhotos(user?.id)

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

  return (
    <div className="mx-auto min-h-screen max-w-app bg-white">
      <Header onAddPhoto={() => setShowUpload(true)} />
      <Gallery photos={photos} loading={photosLoading} error={error} onUpdate={updatePhoto} onDelete={deletePhoto} />
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUpload={uploadPhotos} />}
    </div>
  )
}
