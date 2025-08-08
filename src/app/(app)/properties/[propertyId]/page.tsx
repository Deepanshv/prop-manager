
// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
// It fetches data on the server and passes it to the client component.

import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property } from '../page';
import PropertyDetailClientPage from './client-page';


// This is an extended type that replaces Timestamps with serializable Dates
export type SerializableProperty = Omit<Property, 'purchaseDate' | 'soldDate'> & {
    purchaseDate: Date;
    soldDate?: Date;
};

export default async function PropertyDetailPage({ params }: { params: { propertyId: string } }) {

    // This is our server-side data fetching function.
    const fetchProperty = async (id: string): Promise<SerializableProperty | null> => {
        if (!db || !id) return null;
        try {
            const propDocRef = doc(db, 'properties', id);
            const docSnap = await getDoc(propDocRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                 // SECURITY NOTE: In a production app, a server-side ownership check
                 // is critical here. Before returning the data, you must verify
                 // that the currently authenticated user's ID matches `docSnap.data().ownerUid`.
                const property: Property = { id: docSnap.id, ...data } as Property;

                // ** THE FIX IS HERE **
                // Convert Firestore Timestamps to standard JavaScript Date objects
                // before passing them to the client component.
                return {
                    ...property,
                    purchaseDate: property.purchaseDate.toDate(),
                    soldDate: property.soldDate ? property.soldDate.toDate() : undefined,
                };
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
