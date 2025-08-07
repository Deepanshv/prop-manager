

'use client'

import { collection, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
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

function ProspectDetailClientPage({ prospectId, initialProspect }: { prospectId: string, initialProspect: Prospect | null }) {
  const { user } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    if (!initialProspect) {
       toast({ title: 'Error', description: 'Prospect not found or you do not have access.', variant: 'destructive' })
       router.push('/prospects')
    }
    // We confirm the user has access on the client side
    if (initialProspect && user && initialProspect.ownerUid !== user.uid) {
        toast({ title: 'Error', description: 'You do not have access to this prospect.', variant: 'destructive' })
        router.push('/prospects');
    }
  }, [initialProspect, user, router, toast])
  
  const handleConvertProspect = React.useCallback(async (prospectData: ProspectFormData) => {
    if (!user || !db) return;

    const toastId = toast({
      title: 'Converting Prospect...',
      description: `Please wait while "${prospectData.name}" is converted to a property.`,
    });

    try {
      const newPropertyRef = doc(collection(db, 'properties'))

      const newPropertyData: Omit<Property, 'id'> = {
        name: prospectData.name,
        ownerUid: user.uid,
        address: prospectData.address || { street: '', city: '', state: '', zip: '' },
        landDetails: { area: 0, areaUnit: 'Square Feet' }, // Default value
        propertyType: prospectData.propertyType as Property['propertyType'] || 'Open Land',
        purchaseDate: Timestamp.now(),
        purchasePrice: 0,
        status: 'Owned',
        remarks: prospectData.contactInfo ? `Contact Info: ${prospectData.contactInfo}` : '',
      }
      
      await setDoc(newPropertyRef, newPropertyData)
      
      const prospectDocRef = doc(db, 'prospects', prospectId);
      await updateDoc(prospectDocRef, { status: 'Converted' });

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

  }, [user, db, toast, router, prospectId]);

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

  if (!initialProspect) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
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

// This is a Server Component responsible for fetching initial data.
export default async function ProspectDetailPage({ params }: { params: { prospectId: string } }) {

    const fetchProspect = async (id: string): Promise<Prospect | null> => {
        if (!db || !id) return null;
        try {
            const prospectDocRef = doc(db, 'prospects', id);
            const docSnap = await getDoc(prospectDocRef);
            if (docSnap.exists()) {
                 // NOTE: In a real app, you must also check if the currently
                // logged-in user has permission to view this prospect.
                return { id: docSnap.id, ...docSnap.data() } as Prospect;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch prospect on server:", error);
            return null;
        }
    };

    const initialProspect = await fetchProspect(params.prospectId);

    return <ProspectDetailClientPage prospectId={params.prospectId} initialProspect={initialProspect} />;
}
