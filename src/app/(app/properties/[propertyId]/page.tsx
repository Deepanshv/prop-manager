
'use client'

import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { FileManager } from '@/components/file-manager'
import { useAuth } from '../../layout'
import type { Property } from '../page'
import { PropertyForm, type PropertyFormData } from '@/components/property-form'
import { MediaManager } from '@/components/media-manager'


export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const propertyId = params.propertyId as string

  const [isSaving, setIsSaving] = React.useState(false)
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchAndSetProperty = React.useCallback(async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
        const propDocRef = doc(db, 'properties', propertyId);
        const docSnap = await getDoc(propDocRef);
        if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
            setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        } else {
            toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
            router.push('/properties');
        }
    } catch (error) {
        console.error("Failed to fetch property on client:", error);
        toast({ title: 'Error', description: 'Failed to load property details.', variant: 'destructive' })
        router.push('/properties');
    } finally {
        setLoading(false);
    }
  }, [propertyId, user, router, toast]);

  React.useEffect(() => {
    if (user) {
        fetchAndSetProperty();
    }
  }, [user, fetchAndSetProperty]);

  const formInitialData = React.useMemo(() => {
    if (!property) return undefined;

    // This is the corrected initial data. We must convert Timestamps to Date objects for the form.
    return {
      ...property,
      purchaseDate: property.purchaseDate.toDate(),
      soldDate: property.soldDate?.toDate(),
    };
  }, [property]);


  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    const propertyData: Record<string, any> = {
        name: data.name,
        ownerUid: user.uid,
        address: {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state,
            zip: data.address.zip,
            landmark: data.address.landmark ?? null,
            latitude: data.address.latitude ?? null,
            longitude: data.address.longitude ?? null,
        },
        landDetails: {
            area: data.landDetails.area,
            areaUnit: data.landDetails.areaUnit,
            khasraNumber: data.landDetails.khasraNumber ?? null,
            landbookNumber: data.landDetails.landbookNumber ?? null,
        },
        propertyType: data.propertyType,
        purchaseDate: Timestamp.fromDate(data.purchaseDate),
        purchasePrice: data.purchasePrice,
        pricePerUnit: data.pricePerUnit,
        remarks: data.remarks ?? null,
        status: data.status,
    };

    // Handle conditional fields based on property type
    if (data.propertyType === 'Open Land') {
        propertyData.landType = data.landType ?? null;
        propertyData.isDiverted = data.isDiverted ?? false;
    } else {
        propertyData.landType = null;
        propertyData.isDiverted = null;
    }

    // Handle status-specific fields based on validated data
    if (data.status === 'Sold') {
        propertyData.isListedPublicly = false;
        propertyData.listingPrice = null;
        propertyData.listingPricePerUnit = null;
        propertyData.soldDate = data.soldDate ? Timestamp.fromDate(data.soldDate) : null;
        propertyData.soldPrice = data.soldPrice ?? null;
    } else if (data.status === 'For Sale') {
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
        propertyData.isListedPublicly = data.isListedPublicly ?? false;
        propertyData.listingPrice = data.isListedPublicly ? data.listingPrice : null;
        propertyData.listingPricePerUnit = data.isListedPublicly ? data.listingPricePerUnit : null;
    } else { // 'Owned' status
        propertyData.isListedPublicly = false;
        propertyData.listingPrice = null;
        propertyData.listingPricePerUnit = null;
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
    }

    try {
      const propDocRef = doc(db, 'properties', propertyId)
      await updateDoc(propDocRef, propertyData)
      toast({ title: 'Success', description: 'Property updated successfully.' })
        
      if (propertyData.status === 'Sold') {
          router.push('/sold-properties')
      } else {
          await fetchAndSetProperty(); // Refresh data on the page
      }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    } finally {
        setIsSaving(false)
    }
  };

  if (loading || !property || !formInitialData) {
    return (
        <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
      </div>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="files">Media & Files</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Edit Property Details</CardTitle>
                    <CardDescription>Update the information for this property.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PropertyForm 
                        mode="edit"
                        onSubmit={onSubmit}
                        initialData={formInitialData}
                        isSaving={isSaving}
                        submitButtonText="Save Changes"
                    >
                       <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                    </PropertyForm>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="files">
            <div className="mt-4 space-y-6">
                <MediaManager entityType="properties" entityId={property.id} />
                <FileManager entityType="properties" entityId={property.id} />
            </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
