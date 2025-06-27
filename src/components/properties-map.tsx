
'use client'

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { Property } from '@/app/(app)/properties/page';
import L, { LatLngExpression } from 'leaflet';
import * as React from 'react';

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

// This child component is the key to safely and dynamically updating the map's view.
// It runs after the main <MapContainer> has been created and won't cause re-initialization.
function MapUpdater({ properties }: { properties: Property[] }) {
    const map = useMap(); // This hook gives us access to the map instance.

    React.useEffect(() => {
        // Filter for properties that have valid coordinates.
        const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];
        
        if (propertiesWithCoords.length > 0) {
            // Create a bounding box that encompasses all property markers.
            const bounds = new L.LatLngBounds(
                propertiesWithCoords.map(p => [p.latitude!, p.longitude!])
            );
            
            // Tell the map to smoothly fly to and fit these bounds.
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        } else {
            // If there are no properties, fly to a default world view.
            map.flyTo([30, 0], 2);
        }
    // This effect runs whenever the list of properties changes.
    }, [properties, map]);

    // This component doesn't render anything itself.
    return null;
}

const PropertiesMap = ({ properties }: PropertiesMapProps) => {
    // These are static initial values. They are used only when the map is first created
    // and will not be changed, preventing the re-initialization error.
    const initialCenter: LatLngExpression = [30, 0];
    const initialZoom = 2;
    const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];

    return (
        <MapContainer center={initialCenter} zoom={initialZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Render a marker for each property with coordinates */}
            {propertiesWithCoords.map(property => (
                <Marker key={property.id} position={[property.latitude!, property.longitude!]}>
                    <Popup>
                       <strong>{property.address.street}</strong><br/>
                       {property.address.city}, {property.address.state}
                    </Popup>
                </Marker>
            ))}
            {/* The MapUpdater handles all dynamic view changes */}
            <MapUpdater properties={properties} />
        </MapContainer>
    )
}

export default PropertiesMap;
