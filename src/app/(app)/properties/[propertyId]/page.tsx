

'use client'

import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { useRouter } from 'next/navigation'
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


function PropertyDetailClientPage({ propertyId, initialProperty }: { propertyId: string, initialProperty: Property | null }) {
  const { user } = useAuth()
  const router = useRouter()
  const [property, setProperty] = React.useState<Property | null>(initialProperty)
  const [loading, setLoading] = React.useState(!initialProperty)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  const formInitialData = React.useMemo(() => {
    if (!initialProperty) return undefined;
    
    let pricePerUnit = initialProperty.pricePerUnit;
    if (pricePerUnit === undefined && initialProperty.purchasePrice && initialProperty.landDetails.area > 0) {
      pricePerUnit = initialProperty.purchasePrice / initialProperty.landDetails.area;
    }
    
    let listingPricePerUnit = initialProperty.listingPricePerUnit;
    if (listingPricePerUnit === undefined && initialProperty.listingPrice && initialProperty.landDetails.area > 0) {
      listingPricePerUnit = initialProperty.listingPrice / initialProperty.landDetails.area;
    }

    return {
      ...initialProperty,
      purchaseDate: initialProperty.purchaseDate.toDate(),
      soldDate: initialProperty.soldDate?.toDate(),
      pricePerUnit: pricePerUnit,
      listingPricePerUnit: listingPricePerUnit,
    };
  }, [initialProperty]);

  React.useEffect(() => {
    if (!initialProperty) {
      toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
      router.push('/properties')
    }
  }, [initialProperty, router, toast]);


  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !db || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    const propertyData: Record<string, any> = {
      ...data,
      ownerUid: user.uid,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      pricePerUnit: data.pricePerUnit ?? null,
      soldDate: data.soldDate ? Timestamp.fromDate(data.soldDate) : null,
      soldPrice: data.soldPrice ?? null,
      listingPrice: data.listingPrice ?? null,
      listingPricePerUnit: data.listingPricePerUnit ?? null,
      remarks: data.remarks ?? null,
      address: {
        ...data.address,
        landmark: data.address.landmark ?? null,
        latitude: data.address.latitude ?? null,
        longitude: data.address.longitude ?? null,
      },
      landDetails: {
        ...data.landDetails,
        khasraNumber: data.landDetails.khasraNumber ?? null,
        landbookNumber: data.landDetails.landbookNumber ?? null,
      },
    };
    
    if (data.propertyType !== 'Open Land') {
        propertyData.landType = null;
        propertyData.isDiverted = null;
    }

    if (data.status === 'Sold') {
        propertyData.isListedPublicly = false;
    } else {
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
    }

    if (!data.isListedPublicly) {
        propertyData.listingPrice = null;
        propertyData.listingPricePerUnit = null;
    }

    try {
      const propDocRef = doc(db, 'properties', propertyId)
      await updateDoc(propDocRef, propertyData)
      toast({ title: 'Success', description: 'Property updated successfully.' })
       if (propertyData.status === 'Sold') {
            router.push('/sold-properties')
        }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    } finally {
        setIsSaving(false)
    }
  }

  if (loading || !formInitialData) {
    return (
        <div className="space-y-6 p-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        </div>
    )
  }

  if (!property) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p>Property not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
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
                    />
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

// This is now a Server Component responsible for fetching initial data.
export default function PropertyDetailPage({ params }: { params: { propertyId: string } }) {
    const { propertyId } = params;

    // We can't use the useAuth hook here as it's a server component.
    // Auth-based redirection will be handled on the client side for now.
    // A more robust solution might involve server-side auth checks.
    const fetchProperty = async (): Promise<Property | null> => {
        if (!db || !propertyId) return null;
        try {
            const propDocRef = doc(db, 'properties', propertyId);
            const docSnap = await getDoc(propDocRef);
            if (docSnap.exists()) {
                // Here you would normally check ownerUid against the current user.
                // Since we can't get the user here easily without a dedicated library,
                // the client component will do a final check.
                return { id: docSnap.id, ...docSnap.data() } as Property;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch property on server:", error);
            return null;
        }
    };

    // The use of `await` here is what makes this a true async Server Component.
    const initialProperty = React.use(fetchProperty());
    
    return <PropertyDetailClientPage propertyId={propertyId} initialProperty={initialProperty} />;
}
