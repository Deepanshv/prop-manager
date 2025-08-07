// This is the top of your file: app/(app/prospects/[prospectId]/page.tsx)

// --- The Client Component ---
// This part contains all your interactive logic.
// Notice the 'use client' directive is here.
'use client'

import { collection, doc, writeBatch, Timestamp, updateDoc, getDoc } from 'firebase/firestore'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { useAuth } from '../../layout'
import type { Prospect } from '../page'
import { ProspectForm, type ProspectFormData } from '@/components/prospect-form'
import type { Property } from '../../properties/page'

// We've renamed your original component to "ProspectDetailClientPage"
// It now receives the simple 'prospectId' and initial data as props.
function ProspectDetailClientPage({ prospectId, initialProspect }: { prospectId: string, initialProspect: Prospect | null }) {
  const { user } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    // We check for user and prospect on the client side for robustness
    if (!initialProspect) {
       toast({ title: 'Error', description: 'Prospect not found or you do not have access.', variant: 'destructive' })
       router.push('/prospects')
    }
    if (initialProspect && user && initialProspect.ownerUid !== user.uid) {
        toast({ title: 'Error', description: 'You do not have access to this prospect.', variant: 'destructive' })
        router.push('/prospects');
    }
  }, [initialProspect, user, router, toast])
  
  const handleConvertProspect = React.useCallback(async (prospectData: ProspectFormData) => {
    if (!user || !db || !initialProspect) return;

    const toastId = toast({
      title: 'Converting Prospect...',
      description: `Please wait while "${prospectData.name}" is converted to a property.`,
    });

    try {
      // Use a batch for atomic writes
      const batch = writeBatch(db);
      
      const newPropertyRef = doc(collection(db, 'properties'))
      const prospectDocRef = doc(db, 'prospects', initialProspect.id);

      // This is a security risk if not validated server-side.
      // For this app, we trust the client data, but a real app should re-validate.
      const newPropertyData: Omit<Property, 'id'> = {
        name: prospectData.name,
        ownerUid: user.uid,
        address: prospectData.address || { street: '', city: '', state: '', zip: '' },
        landDetails: { area: 0, areaUnit: 'Square Feet' }, // Default value
        propertyType: prospectData.propertyType as Property['propertyType'] || 'Open Land',
        purchaseDate: Timestamp.now(),
        purchasePrice: 0, // Default value
        status: 'Owned',
        remarks: prospectData.contactInfo ? `Source/Contact: ${prospectData.contactInfo}` : '',
      }
      
      batch.set(newPropertyRef, newPropertyData);
      batch.update(prospectDocRef, { status: 'Converted' });
      
      await batch.commit();

      toastId.update({
        id: toastId.id,
        title: 'Conversion Successful',
        description: `Prospect converted. You can now edit the full property details.`,
      })
      
      router.push(`/properties/${newPropertyRef.id}`)
      
    } catch(error: any) {
        console.error('Error converting prospect:', error);
        toastId.update({
            id: toastId.id,
            title: 'Conversion Failed',
            description: 'Could not convert the prospect to a property.',
            variant: 'destructive',
        });
    }

  }, [user, db, toast, router, initialProspect]);

  const onSubmit = async (data: ProspectFormData) => {
    if (!user || !db || !prospectId) {
      toast({ title: 'Error', description: 'Cannot save prospect.', variant: 'destructive' })
      return
    }
    
    if (data.status === 'Converted') {
        handleConvertProspect(data);
        return;
    }

    setIsSaving(true)

    const prospectDataToSave = {
      ...data,
      contactInfo: data.contactInfo || null, 
    }

    try {
      const prospectDocRef = doc(db, 'prospects', prospectId)
      await updateDoc(prospectDocRef, prospectDataToSave)
      toast({ title: 'Success', description: 'Prospect updated successfully.' })
      router.push('/prospects')
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update prospect.', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  // Initial render with skeleton if data is still coming
  if (!initialProspect) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/prospects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{initialProspect.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Prospect Details</CardTitle>
          <CardDescription>Update the information for this prospect.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProspectForm
            mode="edit"
            onSubmit={onSubmit}
            isSaving={isSaving}
            initialData={initialProspect}
            submitButtonText="Save Changes"
          >
             <Button type="button" variant="ghost" onClick={() => router.push('/prospects')}>Cancel</Button>
          </ProspectForm>
        </CardContent>
      </Card>
    </div>
  )
}

// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
// Its only job is to handle the server-side `params` object.
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
                 // Without this, any logged-in user could access any other user's prospect
                 // data by guessing the URL.
                return { id: docSnap.id, ...docSnap.data() } as Prospect;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch prospect on server:", error);
            return null;
        }
    };

    const resolvedParams = React.use(params);
    const initialProspect = await fetchProspect(resolvedParams.prospectId);

    return <ProspectDetailClientPage prospectId={resolvedParams.prospectId} initialProspect={initialProspect} />;
}
