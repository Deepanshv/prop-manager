
// This is the top of your file: app/(app)/properties/[propertyId]/page.tsx

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
import { useAuth } from '../../layout' // Assuming this path is correct
import type { Property } from '../page'
import { PropertyForm, type PropertyFormData } from '@/components/property-form'
import { MediaManager } from '@/components/media-manager'


// We've renamed your original component to "PropertyDetailClientPage"
// It now receives the simple 'propertyId' and initial data as props.
function PropertyDetailClientPage({ propertyId, initialProperty }: { propertyId: string, initialProperty: Property | null }) {
  const { user } = useAuth()
  const router = useRouter()
  const [property, setProperty] = React.useState<Property | null>(initialProperty)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  const [formInitialData, setFormInitialData] = React.useState<Partial<PropertyFormData> | undefined>(undefined);

  React.useEffect(() => {
    // We check for user and property on the client side for robustness
    if (!initialProperty) {
       toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
       router.push('/properties')
    }
    if (initialProperty && user && initialProperty.ownerUid !== user.uid) {
        toast({ title: 'Error', description: 'You do not have access to this property.', variant: 'destructive' })
        router.push('/properties');
    }
  }, [initialProperty, user, router, toast])

  React.useEffect(() => {
    if (initialProperty) {
        let pricePerUnit = initialProperty.pricePerUnit;
        if (pricePerUnit === undefined && initialProperty.purchasePrice && initialProperty.landDetails.area > 0) {
            pricePerUnit = initialProperty.purchasePrice / initialProperty.landDetails.area;
        }
        
        let listingPricePerUnit = initialProperty.listingPricePerUnit;
        if (listingPricePerUnit === undefined && initialProperty.listingPrice && initialProperty.landDetails.area > 0) {
            listingPricePerUnit = initialProperty.listingPrice / initialProperty.landDetails.area;
        }

        setFormInitialData({
            ...initialProperty,
            purchaseDate: initialProperty.purchaseDate.toDate(),
            soldDate: initialProperty.soldDate?.toDate(),
            pricePerUnit: pricePerUnit,
            listingPricePerUnit: listingPricePerUnit,
        });
    }
  }, [initialProperty]);


  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    // Prepare data for Firestore, converting JS Dates back to Timestamps
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
    
    // Conditional logic based on form data
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
    if (!data.isListedPublicly || data.status !== 'For Sale') {
        propertyData.listingPrice = null;
        propertyData.listingPricePerUnit = null;
    }

    try {
      const propDocRef = doc(db, 'properties', propertyId)
      await updateDoc(propDocRef, propertyData)
      toast({ title: 'Success', description: 'Property updated successfully.' })
        if (propertyData.status === 'Sold') {
            router.push('/sold-properties')
        } else {
            const docSnap = await getDoc(propDocRef);
             if (docSnap.exists()) {
                const updatedPropData = { id: docSnap.id, ...docSnap.data() } as Property;
                setProperty(updatedPropData);
             }
        }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    } finally {
        setIsSaving(false)
    }
  }

  // Loading state UI
  if (!formInitialData || !property) {
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


// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
// Its only job is to handle the server-side `params` object.
export default async function PropertyDetailPage({ params }: { params: { propertyId: string } }) {

    const fetchProperty = async (id: string): Promise<Property | null> => {
        if (!db || !id) return null;
        try {
            const propDocRef = doc(db, 'properties', id);
            const docSnap = await getDoc(propDocRef);
            if (docSnap.exists()) {
                 // SECURITY NOTE: In a production app, a server-side ownership check
                 // is critical here. Before returning the data, you must verify
                 // that the currently authenticated user's ID matches `docSnap.data().ownerUid`.
                 // Without this, any logged-in user could access any other user's property
                 // data by guessing the URL.
                return { id: docSnap.id, ...docSnap.data() } as Property;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch property on server:", error);
            return null;
        }
    };

    const initialProperty = await fetchProperty(params.propertyId);
    
    return <PropertyDetailClientPage propertyId={params.propertyId} initialProperty={initialProperty} />;
}

    