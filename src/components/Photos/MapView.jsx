import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { statusMeta } from '../../statusConfig'

// react-leaflet's default marker icons reference image paths that don't
// survive bundling — point them at the CDN copies instead.
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function MapView({ photos, onOpen }) {
  const located = photos.filter((p) => p.lat != null && p.lng != null)

  if (located.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-ink-600">
        No photos have a location attached yet. Turn on "Attach my current GPS location"
        when adding a photo to see it here.
      </div>
    )
  }

  const center = [located[0].lat, located[0].lng]

  return (
    <div className="h-[calc(100vh-220px)] w-full">
      <MapContainer center={center} zoom={15} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((photo) => {
          const status = statusMeta(photo.status)
          return (
            <Marker key={photo.id} position={[photo.lat, photo.lng]} icon={defaultIcon}>
              <Popup>
                <button onClick={() => onOpen(photo)} className="block text-left">
                  {photo.url && (
                    <img src={photo.url} alt={photo.location} className="mb-1 h-20 w-32 rounded object-cover" />
                  )}
                  <p className="flex items-center gap-1 text-xs font-medium">
                    <span className="status-dot" style={{ backgroundColor: status.color }} />
                    {photo.location || 'Untitled location'}
                  </p>
                  {photo.room && <p className="text-xs text-ink-600">{photo.room}</p>}
                </button>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
