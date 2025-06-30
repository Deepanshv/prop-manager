
'use client'

import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft, FileQuestion, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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


export default function PropertyDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const propertyId = params.propertyId
  const router = useRouter()
  const [property, setProperty] = React.useState<Property | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  const [formInitialData, setFormInitialData] = React.useState<Partial<PropertyFormData> | undefined>(undefined);

  React.useEffect(() => {
    if (!user || !db || !propertyId) {
      setLoading(false)
      return
    }

    const fetchProperty = async () => {
      try {
        const propDocRef = doc(db, 'properties', propertyId as string)
        const docSnap = await getDoc(propDocRef)
        if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
          const propData = { id: docSnap.id, ...docSnap.data() } as Property
          setProperty(propData)
          setFormInitialData({
            ...propData,
            purchaseDate: propData.purchaseDate.toDate(),
            soldDate: propData.soldDate?.toDate(),
          });
        } else {
          toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
          router.push('/properties')
        }
      } catch (error) {
        console.error('Error fetching property:', error)
        toast({ title: 'Error', description: 'Failed to fetch property data.', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }

    fetchProperty()
  }, [user, db, propertyId, router, toast])


  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !db || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    const propertyData = {
      ...data,
      ownerUid: user.uid,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      soldDate: data.soldDate ? Timestamp.fromDate(data.soldDate) : null,
      soldPrice: data.soldPrice ?? null,
      listingPrice: data.listingPrice ?? null,
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
    
    if (data.status === 'Sold') {
        propertyData.isListedPublicly = false;
        propertyData.listingPrice = null;
    } else {
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
    }

    if (!data.isListedPublicly) {
        propertyData.listingPrice = null;
    }

    try {
      const propDocRef = doc(db, 'properties', propertyId as string)
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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        </main>
    )
  }

  if (!property) {
    return (
      <main className="flex-1 flex items-center justify-center p-4 lg:p-6">
        <p>Property not found.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
            <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
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
    </main>
  )
}
