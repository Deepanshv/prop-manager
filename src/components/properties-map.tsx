
'use client'

import 'leaflet/dist/leaflet.css';
import L, { Map } from 'leaflet';
import * as React from 'react';
import type { Property } from '@/app/(app)/properties/page';

// Leaflet icon workaround
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface PropertiesMapProps {
    properties: Property[];
    focusedPropertyId?: string | null;
}

const PropertiesMap = ({ properties, focusedPropertyId }: PropertiesMapProps) => {
    const mapContainerRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<Map | null>(null);
    const markersRef = React.useRef<L.Marker[]>([]);

    React.useEffect(() => {
        // Initialize map only once
        if (mapContainerRef.current && !mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current, {
                center: [20.5937, 78.9629], // Default center of India
                zoom: 5,
                scrollWheelZoom: false,
                attributionControl: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(mapInstanceRef.current);
        }

        // Cleanup on unmount
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    React.useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.removeFrom(map));
        markersRef.current = [];

        const propertiesWithCoords = properties?.filter(p => p.address.latitude != null && p.address.longitude != null) || [];

        if (propertiesWithCoords.length > 0) {
            propertiesWithCoords.forEach(property => {
                const marker = L.marker([property.address.latitude!, property.address.longitude!])
                    .addTo(map)
                    .bindPopup(`<strong>${property.name}</strong><br/>${property.address.street}, ${property.address.city}`);
                markersRef.current.push(marker);
            });
        }
        
        const propertyToFocus = propertiesWithCoords.find(p => p.id === focusedPropertyId);

        if (propertyToFocus) {
            const latLng: [number, number] = [propertyToFocus.address.latitude!, propertyToFocus.address.longitude!];
            map.flyTo(latLng, 16);
            
            const markerToOpen = markersRef.current.find(m => 
                m.getLatLng().lat === latLng[0] && m.getLatLng().lng === latLng[1]
            );

            // Use timeout to ensure popup opens after flyTo animation is complete
            setTimeout(() => {
                markerToOpen?.openPopup();
            }, 1000);

        } else if (propertiesWithCoords.length > 0) {
            const bounds = new L.LatLngBounds(propertiesWithCoords.map(p => [p.address.latitude!, p.address.longitude!]));
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        } else {
            // Reset to default view if no properties have coordinates
            map.flyTo([20.5937, 78.9629], 5);
        }
    }, [properties, focusedPropertyId]);

    return <div ref={mapContainerRef} style={{ height: '100%', width: '100%', borderRadius: 'inherit' }} />;
};

export default PropertiesMap;
