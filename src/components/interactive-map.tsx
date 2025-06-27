
'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import * as React from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'

// Leaflet icon workaround
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
})

interface InteractiveMapProps {
  center: [number, number]
  onMarkerMove: (lat: number, lng: number) => void
}

const DraggableMarker = ({ onMarkerMove, initialPosition }: { onMarkerMove: (lat: number, lng: number) => void, initialPosition: [number, number] }) => {
  const markerRef = React.useRef<L.Marker>(null)

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker != null) {
          const { lat, lng } = marker.getLatLng()
          onMarkerMove(lat, lng)
        }
      },
    }),
    [onMarkerMove]
  )
  
  // This effect ensures the marker position updates if the parent's `center` state changes,
  // for example, after a geocoding call.
  React.useEffect(() => {
    if (markerRef.current) {
        markerRef.current.setLatLng(initialPosition);
    }
  }, [initialPosition]);

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={initialPosition}
      ref={markerRef}
    />
  )
}

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap()
  React.useEffect(() => {
    map.flyTo(center, map.getZoom() < 13 ? 13 : map.getZoom())
  }, [center, map])
  return null
}

export const InteractiveMap = ({ center, onMarkerMove }: InteractiveMapProps) => {
  return (
    <div className="h-96 w-full rounded-md border overflow-hidden">
      <MapContainer center={center} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker onMarkerMove={onMarkerMove} initialPosition={center} />
        <MapUpdater center={center} />
      </MapContainer>
    </div>
  )
}
