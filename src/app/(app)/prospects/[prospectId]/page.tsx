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
// It now receives the simple 'prospectId' as a prop.
function ProspectDetailClientPage({ prospectId }: { prospectId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [prospect, setProspect] = React.useState<Prospect | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    if (!user || !prospectId) {
       setLoading(false);
       return;
    }
    
    setLoading(true);
    const getProspect = async () => {
        try {
            const prospectDocRef = doc(db, 'prospects', prospectId);
            const docSnap = await getDoc(prospectDocRef);

            if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
                setProspect({ id: docSnap.id, ...docSnap.data() } as Prospect);
            } else {
                toast({ title: 'Error', description: 'Prospect not found or you do not have access.', variant: 'destructive' })
                router.push('/prospects');
            }
        } catch(e) {
             toast({ title: 'Error', description: 'Failed to fetch prospect details.', variant: 'destructive' })
        } finally {
            setLoading(false);
        }
    }
    getProspect();

  }, [prospectId, user, router, toast]);
  
  const handleConvertProspect = React.useCallback(async (prospectData: ProspectFormData) => {
    if (!user || !db || !prospect) return;

    const toastId = toast({
      title: 'Converting Prospect...',
      description: `Please wait while "${prospectData.name}" is converted to a property.`,
    });

    try {
      // Use a batch for atomic writes
      const batch = writeBatch(db);
      
      const newPropertyRef = doc(collection(db, 'properties'))
      const prospectDocRef = doc(db, 'prospects', prospect.id);

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

  }, [user, db, toast, router, prospect]);

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
  if (loading) {
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

  if (!prospect) {
    return (
     <div className="flex-1 flex items-center justify-center p-6">
       <p>Prospect not found.</p>
     </div>
   )
 }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/prospects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{prospect.name}</h1>
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
            initialData={prospect}
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
export default function ProspectDetailPage({ params }: { params: { prospectId: string } }) {
    // 1. Unwrap the params promise at the top of the server component.
    const resolvedParams = React.use(params);
    const { prospectId } = resolvedParams;

    // 2. Pass the resolved, primitive `prospectId` string as a prop to the Client Component.
    return <ProspectDetailClientPage prospectId={prospectId} />;
}
