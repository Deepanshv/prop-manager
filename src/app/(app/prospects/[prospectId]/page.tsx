
'use client'

import { collection, doc, writeBatch, Timestamp, updateDoc, getDoc } from 'firebase/firestore'
import { ArrowLeft } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
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


export default function ProspectDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const prospectId = params.prospectId as string;
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()
  const [prospect, setProspect] = React.useState<Prospect | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const fetchProspect = React.useCallback(async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
        const prospectDocRef = doc(db, 'prospects', prospectId);
        const docSnap = await getDoc(prospectDocRef);
        if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
            setProspect({ id: docSnap.id, ...docSnap.data() } as Prospect);
        } else {
            toast({ title: 'Error', description: 'Prospect not found or you do not have access.', variant: 'destructive' })
            router.push('/prospects');
        }
    } catch (error) {
        console.error("Failed to fetch prospect on client:", error);
        toast({ title: 'Error', description: 'Failed to load prospect details.', variant: 'destructive' })
        router.push('/prospects');
    } finally {
        setLoading(false);
    }
  }, [prospectId, user, router, toast]);

  React.useEffect(() => {
    if (user) {
        fetchProspect();
    }
  }, [user, fetchProspect]);
  
  const handleConvertProspect = React.useCallback(async (prospectData: ProspectFormData) => {
    if (!user || !db || !prospect) return;

    const toastId = toast({
      title: 'Converting Prospect...',
      description: `Please wait while "${prospectData.name}" is converted to a property.`,
    });

    try {
      const batch = writeBatch(db);
      
      const newPropertyRef = doc(collection(db, 'properties'))
      const prospectDocRef = doc(db, 'prospects', prospect.id);

      // Create a complete property record from the prospect data
      const newPropertyData: Omit<Property, 'id'> = {
        name: prospectData.name || 'Unnamed Property',
        ownerUid: user.uid,
        address: prospectData.address,
        landDetails: { area: 1, areaUnit: 'Square Feet' }, // Use a valid default
        propertyType: prospectData.propertyType as Property['propertyType'],
        purchaseDate: Timestamp.now(),
        purchasePrice: 1, // Default non-zero value, to be edited
        status: 'Owned',
        isListedPublicly: false,
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

  }, [user, toast, router, prospect]);

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
      dateAdded: Timestamp.now(), // update dateAdded on edit
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

  if (loading || !prospect) {
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
            initialData={{...prospect, dateAdded: prospect.dateAdded.toDate()}}
            submitButtonText="Save Changes"
          >
             <Button type="button" variant="ghost" onClick={() => router.push('/prospects')}>Cancel</Button>
          </ProspectForm>
        </CardContent>
      </Card>
    </div>
  )
}
