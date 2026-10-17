import { useState } from 'react'
import PhotoCard from '../Photos/PhotoCard'
import PhotoDetail from '../Photos/PhotoDetail'
import { projectStatusMeta } from '../../statusConfig'
import { fmtDateRange, fmtMoney } from '../../lib/format'

export default function ProjectDetail({
  project,
  finance,
  isAdmin,
  canEdit,
  photos,
  onBack,
  onEdit,
  onUpdatePhoto,
  onDeletePhoto,
  suggestions,
  projects,
  onCreateProject
}) {
  const [openPhoto, setOpenPhoto] = useState(null)
  const status = projectStatusMeta(project.status)
  const dates = fmtDateRange(project.start_date, project.end_date)

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-medium text-ink-600">
          ← All projects
        </button>
        {canEdit && (
          <button onClick={onEdit} className="rounded-full border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-600">
            Edit
          </button>
        )}
      </div>

      <div className="md:grid md:grid-cols-[18rem_1fr] md:gap-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-900">{project.name}</h2>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-800">
              <span className="status-dot" style={{ backgroundColor: status.color }} />
              {status.label}
            </span>
          </div>

          {project.client && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Client</p>
              <p className="text-base text-ink-900">{project.client}</p>
            </div>
          )}
          {project.site_address && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Site address</p>
              <p className="text-base text-ink-900">{project.site_address}</p>
            </div>
          )}
          {dates && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Dates</p>
              <p className="text-base text-ink-900">{dates}</p>
            </div>
          )}
          {project.notes && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Notes</p>
              <p className="whitespace-pre-line text-base text-ink-900">{project.notes}</p>
            </div>
          )}

          {isAdmin && (
            <div className="rounded-xl border border-ink-100 bg-ink-50 p-3">
              <p className="mb-2 text-xs font-semibold text-ink-800">Money (admins only)</p>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Budget</dt>
                  <dd className="text-ink-900">{fmtMoney(finance?.budget)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Markup</dt>
                  <dd className="text-ink-900">{Number(finance?.markup_pct ?? 0)}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">GST (10%)</dt>
                  <dd className="text-ink-900">{(finance?.gst_enabled ?? true) ? 'Added' : 'Not added'}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="mt-6 md:mt-0">
          <h3 className="mb-3 text-sm font-semibold text-ink-800">
            Photos ({photos.length})
          </h3>
          {photos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
              No photos linked to this project yet. Pick this project when you add photos.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onOpen={setOpenPhoto} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openPhoto && (
        <PhotoDetail
          photo={openPhoto}
          onClose={() => setOpenPhoto(null)}
          onUpdate={onUpdatePhoto}
          onDelete={onDeletePhoto}
          suggestions={suggestions}
          projects={projects}
          onCreateProject={onCreateProject}
        />
      )}
    </div>
  )
}
