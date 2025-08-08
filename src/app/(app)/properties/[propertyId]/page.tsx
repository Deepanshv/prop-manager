
// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
// It fetches data on the server and passes it to the client component.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property } from '../page';
import PropertyDetailClientPage from './client-page';


export default async function PropertyDetailPage({ params }: { params: { propertyId: string } }) {

    // This is our server-side data fetching function.
    const fetchProperty = async (id: string): Promise<Property | null> => {
        if (!db || !id) return null;
        try {
            const propDocRef = doc(db, 'properties', id);
            const docSnap = await getDoc(propDocRef);
            if (docSnap.exists()) {
                 // SECURITY NOTE: In a production app, a server-side ownership check
                 // is critical here. Before returning the data, you must verify
                 // that the currently authenticated user's ID matches `docSnap.data().ownerUid`.
                return { id: docSnap.id, ...docSnap.data() } as Property;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch property on server:", error);
            return null;
        }
    };
    
    const propertyId = params.propertyId;
    const initialProperty = await fetchProperty(propertyId);

    // Render the Client Component and pass the fetched data as a prop
    return <PropertyDetailClientPage propertyId={propertyId} initialProperty={initialProperty} />;
}
