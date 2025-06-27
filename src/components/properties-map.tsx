
'use client'

import 'leaflet/dist/leaflet.css';
import L, { Map } from 'leaflet';
import * as React from 'react';
import type { Property } from '@/app/(app)/properties/page';

// This is a common workaround for a known issue with Leaflet and bundlers like Webpack.
// It ensures that the default marker icons can be found and displayed correctly.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface PropertiesMapProps {
    properties: Property[];
}

const PropertiesMap = ({ properties }: PropertiesMapProps) => {
    const mapContainerRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<Map | null>(null);
    const markersRef = React.useRef<L.Marker[]>([]);

    React.useEffect(() => {
        // Only initialize the map if the container ref exists and there is no map instance.
        // This effect runs only once on component mount due to the empty dependency array.
        if (mapContainerRef.current && !mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current, {
                center: [30, 0],
                zoom: 2,
                scrollWheelZoom: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(mapInstanceRef.current);
        }

        // The cleanup function is crucial. It runs when the component unmounts.
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove(); // This destroys the map instance and clears its container.
                mapInstanceRef.current = null;
            }
        };
    }, []); // Empty dependency array ensures this runs only on mount and cleanup on unmount.

    React.useEffect(() => {
        // This effect handles updating markers and view when the properties data changes.
        const map = mapInstanceRef.current;
        if (!map) return; // Don't do anything if the map isn't initialized yet.

        // Clear existing markers from the map and from our reference array.
        markersRef.current.forEach(marker => marker.removeFrom(map));
        markersRef.current = [];

        const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];

        if (propertiesWithCoords.length > 0) {
            propertiesWithCoords.forEach(property => {
                const marker = L.marker([property.latitude!, property.longitude!])
                    .addTo(map)
                    .bindPopup(`<strong>${property.address.street}</strong><br/>${property.address.city}, ${property.address.state}`);
                markersRef.current.push(marker); // Add new marker to our reference array.
            });

            const bounds = new L.LatLngBounds(propertiesWithCoords.map(p => [p.latitude!, p.longitude!]));
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        } else {
            // If no properties have coordinates, reset to the default view.
            map.flyTo([30, 0], 2);
        }
    }, [properties]); // Re-run this effect whenever the properties prop changes.

    // The map container div. The ref points to this DOM element.
    return <div ref={mapContainerRef} style={{ height: '100%', width: '100%', borderRadius: 'inherit' }} />;
};

export default PropertiesMap;
