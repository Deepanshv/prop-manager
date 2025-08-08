
// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
// It fetches data on the server and passes it to the client component.

import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Prospect } from '../page'
import ProspectDetailClientPage from './client-page'


export default async function ProspectDetailPage({ params }: { params: { prospectId: string } }) {

    const fetchProspect = async (id: string): Promise<Prospect | null> => {
        if (!db || !id) return null;
        try {
            const prospectDocRef = doc(db, 'prospects', id);
            const docSnap = await getDoc(prospectDocRef);
            if (docSnap.exists()) {
                 // SECURITY NOTE: In a production app, a server-side ownership check
                 // is critical here. Before returning the data, you must verify
                 // that the currently authenticated user's ID matches `docSnap.data().ownerUid`.
                return { id: docSnap.id, ...docSnap.data() } as Prospect;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch prospect on server:", error);
            return null;
        }
    };

    const prospectId = params.prospectId;
    const initialProspect = await fetchProspect(prospectId);

    return <ProspectDetailClientPage prospectId={prospectId} initialProspect={initialProspect} />;
}
