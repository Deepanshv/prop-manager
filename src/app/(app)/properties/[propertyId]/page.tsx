
'use client'

import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft, FileQuestion } from 'lucide-react'
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

  const [property, setProperty] = React.useState<Property | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [formInitialData, setFormInitialData] = React.useState<Partial<PropertyFormData> | undefined>(undefined);

  const propertyId = params.propertyId as string;

  React.useEffect(() => {
    if (!user || !propertyId) return;

    const fetchAndSetProperty = async (id: string) => {
        setLoading(true);
        try {
          const propDocRef = doc(db, 'properties', id);
          const docSnap = await getDoc(propDocRef);

          if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
            const propData = { id: docSnap.id, ...docSnap.data() } as Property;
            setProperty(propData);

            let pricePerUnit = propData.pricePerUnit;
            if (pricePerUnit === undefined && propData.purchasePrice && propData.landDetails.area > 0) {
              pricePerUnit = propData.purchasePrice / propData.landDetails.area;
            }
            
            let listingPricePerUnit = propData.listingPricePerUnit;
            if (listingPricePerUnit === undefined && propData.listingPrice && propData.landDetails.area > 0) {
              listingPricePerUnit = propData.listingPrice / propData.landDetails.area;
            }

            setFormInitialData({
              ...propData,
              purchaseDate: propData.purchaseDate.toDate(),
              soldDate: propData.soldDate?.toDate(),
              pricePerUnit: pricePerUnit,
              listingPricePerUnit: listingPricePerUnit,
            });

          } else {
            toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' });
            router.push('/properties');
          }
        } catch (error) {
          console.error('Error fetching property:', error);
          toast({ title: 'Error', description: 'Failed to fetch property data.', variant: 'destructive' });
        } finally {
          setLoading(false);
        }
    }
    
    fetchAndSetProperty(propertyId)
  }, [user, propertyId, router, toast]);

  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    // Prepare a clean data object for Firestore
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
      pricePerUnit: data.pricePerUnit ?? null,
      remarks: data.remarks ?? null,
      status: data.status,
    };
    
    // Handle conditional fields for Open Land
    if (data.propertyType === 'Open Land') {
        propertyData.landType = data.landType ?? null;
        propertyData.isDiverted = data.isDiverted ?? false;
    } else {
        propertyData.landType = null;
        propertyData.isDiverted = null;
    }
    
    // Handle fields based on status
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
        if (data.isListedPublicly) {
            propertyData.listingPrice = data.listingPrice ?? null;
            propertyData.listingPricePerUnit = data.listingPricePerUnit ?? null;
        } else {
            propertyData.listingPrice = null;
            propertyData.listingPricePerUnit = null;
        }
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
            // This is the key change: force a refresh of the page's data.
            router.refresh();
        }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    } finally {
        setIsSaving(false)
    }
  };


  if (loading) {
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

  if (!property || !formInitialData) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 lg:p-6">
        <p>Property not found.</p>
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
          <TabsTrigger value="files">Files</TabsTrigger>
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
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileQuestion className="text-muted-foreground" /> Recommended Documents</CardTitle>
                        <CardDescription>
                            For a complete record, you can upload documents using the file manager below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li>Registry Document</li>
                            <li>Land Book (Bhu Pustika) Document</li>
                            <li>Owner's Aadhaar Card</li>
                            <li>Owner's PAN Card</li>
                        </ul>
                    </CardContent>
                </Card>
                <FileManager entityType="properties" entityId={property.id} />
            </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
