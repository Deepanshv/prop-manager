
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
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, { attributionControl: false }).setView(center, 13)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map)

      const marker = L.marker(center, { draggable: true }).addTo(map)
      markerRef.current = marker

      const handleInteraction = (latlng: L.LatLng) => {
        if (markerRef.current) {
          const { lat, lng } = latlng;
          markerRef.current.setLatLng(latlng);
          onMarkerMoveRef.current(lat, lng);
        }
      }

      marker.on('dragend', (e) => {
        handleInteraction(e.target.getLatLng());
      })
      
      map.on('click', (e) => {
        handleInteraction(e.latlng);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Empty dependency array ensures it runs only once.

  // Handle updates to center prop from outside (e.g., search)
  React.useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const currentMapCenter = mapRef.current.getCenter()
      if (currentMapCenter.lat !== center[0] || currentMapCenter.lng !== center[1]) {
        mapRef.current.flyTo(center, 13)
        markerRef.current.setLatLng(center)
      }
    }
  }, [center])
  
  return <div ref={mapContainerRef} className="h-96 w-full rounded-md border overflow-hidden" />
}
