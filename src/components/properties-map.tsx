
'use client'

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { Property } from '@/app/(app)/properties/page';
import L, { LatLngExpression } from 'leaflet';
import * as React from 'react';

// Fix for default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


interface PropertiesMapProps {
    properties: Property[];
}

// This component is a child of MapContainer and updates the map view programmatically.
function MapUpdater({ properties }: { properties: Property[] }) {
    const map = useMap();
    const [didInitialFly, setDidInitialFly] = React.useState(false);

    React.useEffect(() => {
        const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];
        
        if (propertiesWithCoords.length > 0 && !didInitialFly) {
            const firstProp = propertiesWithCoords[0];
            const newCenter: LatLngExpression = [firstProp.latitude!, firstProp.longitude!];
            map.flyTo(newCenter, 4);
            setDidInitialFly(true);
        } else if (propertiesWithCoords.length === 0 && didInitialFly) {
             map.flyTo([30, 0], 2);
             setDidInitialFly(false);
        }
    }, [properties, map, didInitialFly]);

    return null;
}

const PropertiesMap = ({ properties }: PropertiesMapProps) => {
    const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];
    const initialCenter: LatLngExpression = [30, 0];
    const initialZoom = 2;

    return (
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
            <MapUpdater properties={properties} />
        </MapContainer>
    )
}

export default PropertiesMap;
