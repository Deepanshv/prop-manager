// This is the top of your file: app/(app/properties/[propertyId]/page.tsx)

// --- The Client Component ---
// This part contains all your interactive logic.
// Notice the 'use client' directive is here.
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


// We've renamed your original component to "PropertyDetailClientPage"
// It now receives the simple 'propertyId' and initial data as props.
function PropertyDetailClientPage({ propertyId }: { propertyId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()

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
  }, [propertyId, user, db, router, toast]);

  // The form's initial data is derived from the state.
  const formInitialData = React.useMemo(() => {
    if (!property) return undefined;

    let pricePerUnit = property.pricePerUnit;
    if (pricePerUnit === undefined && property.purchasePrice && property.landDetails.area > 0) {
      pricePerUnit = property.purchasePrice / property.landDetails.area;
    }
    
    let listingPricePerUnit = property.listingPricePerUnit;
    if (listingPricePerUnit === undefined && property.listingPrice && property.landDetails.area > 0) {
      listingPricePerUnit = property.listingPrice / property.landDetails.area;
    }

    return {
      ...property,
      purchaseDate: property.purchaseDate.toDate(),
      soldDate: property.soldDate?.toDate(),
      pricePerUnit: pricePerUnit,
      listingPricePerUnit: listingPricePerUnit,
    };
  }, [property]);

  React.useEffect(() => {
    fetchAndSetProperty();
  }, [fetchAndSetProperty]);

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
        pricePerUnit: data.pricePerUnit ?? null,
        remarks: data.remarks ?? null,
        status: data.status,
    };

    if (data.propertyType === 'Open Land') {
        propertyData.landType = data.landType ?? null;
        propertyData.isDiverted = data.isDiverted ?? false;
    } else {
        propertyData.landType = null;
        propertyData.isDiverted = null;
    }

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
          // Re-fetch data to show immediate updates
          await fetchAndSetProperty();
      }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    } finally {
        setIsSaving(false)
    }
  };

  // Initial render with skeleton if data is still coming (e.g., during navigation)
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


// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
export default function PropertyDetailPage({ params }: { params: { propertyId: string } }) {
    // Render the Client Component and pass the propertyId as a prop
    return <PropertyDetailClientPage propertyId={params.propertyId} />;
}
