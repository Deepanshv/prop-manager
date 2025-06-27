
'use client'

import 'leaflet/dist/leaflet.css'
import L, { Map, Marker as LeafletMarker } from 'leaflet'
import * as React from 'react'

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

export const InteractiveMap = ({ center, onMarkerMove }: InteractiveMapProps) => {
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<Map | null>(null)
  const markerRef = React.useRef<LeafletMarker | null>(null)
  const onMarkerMoveRef = React.useRef(onMarkerMove)

  React.useEffect(() => {
    onMarkerMoveRef.current = onMarkerMove
  }, [onMarkerMove])

  // Initialize map and marker
  React.useEffect(() => {
    // This effect runs only once on mount
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(center, 13)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      const marker = L.marker(center, { draggable: true }).addTo(map)
      markerRef.current = marker

      marker.on('dragend', () => {
        if (markerRef.current) {
          const { lat, lng } = markerRef.current.getLatLng()
          onMarkerMoveRef.current(lat, lng)
        }
      })
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Empty array means it will only run on mount and unmount

  // Handle updates to center prop
  React.useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const currentMapCenter = mapRef.current.getCenter()
      if (currentMapCenter.lat !== center[0] || currentMapCenter.lng !== center[1]) {
        mapRef.current.flyTo(center)
        markerRef.current.setLatLng(center)
      }
    }
  }, [center])
  
  return <div ref={mapContainerRef} className="h-96 w-full rounded-md border overflow-hidden" />
}
