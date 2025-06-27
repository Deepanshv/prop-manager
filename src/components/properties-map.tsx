
'use client'

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import type { Property } from '@/app/(app)/properties/page'
import { LatLngExpression } from 'leaflet'
import * as React from 'react';

interface PropertiesMapProps {
    properties: Property[];
}

// This component is a child of MapContainer and updates the map view programmatically.
function MapUpdater({ properties }: { properties: Property[] }) {
    const map = useMap();
    const [didInitialFly, setDidInitialFly] = React.useState(false);

    React.useEffect(() => {
        const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];
        
        // Only fly to the location on the first load with properties
        if (propertiesWithCoords.length > 0 && !didInitialFly) {
            const firstProp = propertiesWithCoords[0];
            const newCenter: LatLngExpression = [firstProp.latitude!, firstProp.longitude!];
            
            // Use flyTo for a smooth animated transition
            map.flyTo(newCenter, 4);
            setDidInitialFly(true);
        }
    }, [properties, map, didInitialFly]);

    return null; // This component does not render anything itself
}

export function PropertiesMap({ properties }: PropertiesMapProps) {
    const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];
    
    // Static initial values. MapUpdater will move the view if properties exist.
    const initialCenter: LatLngExpression = [30, 0];
    const initialZoom = 2;

    return (
        // MapContainer props are now static, preventing re-initialization errors.
        <MapContainer center={initialCenter} zoom={initialZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {propertiesWithCoords.map(property => (
                <Marker key={property.id} position={[property.latitude!, property.longitude!]}>
                    <Popup>
                       <strong>{property.address.street}</strong><br/>
                       {property.address.city}, {property.address.state}
                    </Popup>
                </Marker>
            ))}
            {/* This component handles all dynamic view updates */}
            <MapUpdater properties={properties} />
        </MapContainer>
    )
}
