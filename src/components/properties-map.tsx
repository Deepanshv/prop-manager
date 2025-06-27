
'use client'

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import type { Property } from '@/app/(app)/properties/page'
import { LatLngExpression } from 'leaflet'
import * as React from 'react';

interface PropertiesMapProps {
    properties: Property[];
}

export function PropertiesMap({ properties }: PropertiesMapProps) {
    // This state ensures we only render MapContainer on the client after the component has mounted.
    // This helps prevent the "Map container is already initialized" error with React StrictMode.
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const propertiesWithCoords = properties?.filter(p => p.latitude != null && p.longitude != null) || [];
    
    const defaultCenter: LatLngExpression = [30, 0];
    const defaultZoom = 2;
    
    const mapCenter = propertiesWithCoords.length > 0 
        ? [propertiesWithCoords[0].latitude!, propertiesWithCoords[0].longitude!] as LatLngExpression
        : defaultCenter;

    const mapZoom = propertiesWithCoords.length > 0 ? 4 : defaultZoom;

    // Do not render the map on the server or before the initial client-side mount.
    if (!isMounted) {
        return null;
    }

    return (
        <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}>
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
        </MapContainer>
    )
}
