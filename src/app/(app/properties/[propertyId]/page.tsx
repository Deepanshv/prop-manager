
'use client';

import type { Property } from '@/app/(app)/properties/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileManager } from '@/components/file-manager';
import { MediaManager } from '@/components/media-manager';
import { PropertyForm, type PropertyFormData } from '@/components/property-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, FileQuestion, IndianRupee, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useAuth } from '../../layout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

function PropertyDetailClientPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isListingLoading, setIsListingLoading] = React.useState(false);

  // Separate state for listing details to manage them outside the main form
  const [isListedPublicly, setIsListedPublicly] = React.useState(false);
  const [listingPricePerUnit, setListingPricePerUnit] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'properties', propertyId), (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() } as Property;
        setProperty(data);
        setIsListedPublicly(data.isListedPublicly || false);
        setListingPricePerUnit(data.listingPricePerUnit);
      } else {
        toast({ title: 'Error', description: 'Property not found.', variant: 'destructive' });
        router.push('/properties');
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to fetch property details.', variant: 'destructive' });
      setLoading(false);
    });

    return () => unsub();
  }, [propertyId, router, toast]);

  const formInitialData = React.useMemo(() => {
    if (!property) return undefined;
    
    let pricePerUnit = property.pricePerUnit;
    if (pricePerUnit === undefined && property.purchasePrice && property.landDetails.area > 0) {
      pricePerUnit = property.purchasePrice / property.landDetails.area;
    }

    return {
      ...property,
      purchaseDate: property.purchaseDate.toDate(),
      pricePerUnit: pricePerUnit,
    };
  }, [property]);

  const handleCoreDetailsSubmit = async (data: PropertyFormData) => {
    if (!user || !db || !property) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    const propertyData: Record<string, any> = {
      ...data,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      ownerUid: user.uid,
      pricePerUnit: data.pricePerUnit ?? null,
      remarks: data.remarks ?? null,
      address: { ...data.address },
      landDetails: { ...data.landDetails },
    };
    
    if (data.propertyType !== 'Open Land') {
      propertyData.landType = null;
      propertyData.isDiverted = null;
    }

    try {
      const propDocRef = doc(db, 'properties', property.id);
      await updateDoc(propDocRef, propertyData);
      toast({ title: 'Success', description: 'Property details updated successfully.' });
    } catch (error) {
      console.error('Error updating document: ', error);
      toast({ title: 'Error', description: 'Failed to update property details.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleListingToggle = async (checked: boolean) => {
      setIsListedPublicly(checked);
      // If un-listing, save immediately.
      if (!checked) {
          handleListingUpdate();
      }
  }

  const handleListingUpdate = async () => {
    if (!property) return;

    if (isListedPublicly && (!listingPricePerUnit || listingPricePerUnit <= 0)) {
        toast({ title: "Missing Information", description: "Please provide a valid listing price.", variant: "destructive" });
        return;
    }

    setIsListingLoading(true);
    try {
        const area = property.landDetails.area || 0;
        const finalListingPrice = isListedPublicly ? (listingPricePerUnit || 0) * area : null;
        const finalListingPricePerUnit = isListedPublicly ? (listingPricePerUnit || null) : null;
        
        const propDocRef = doc(db, 'properties', property.id);
        await updateDoc(propDocRef, {
            isListedPublicly: isListedPublicly,
            status: isListedPublicly ? 'For Sale' : 'Owned',
            listingPrice: finalListingPrice,
            listingPricePerUnit: finalListingPricePerUnit,
        });
        toast({ title: 'Success', description: 'Listing status updated successfully.' });
    } catch (error) {
        console.error('Error updating listing status: ', error);
        toast({ title: 'Error', description: 'Failed to update listing status.', variant: 'destructive' });
    } finally {
        setIsListingLoading(false);
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

  if (!property) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p>Property not found.</p>
      </div>
    )
  }

  const calculatedListingPrice = (listingPricePerUnit || 0) * (property.landDetails.area || 0);

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
            <div className="mt-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Property Details</CardTitle>
                        <CardDescription>Update the core information for this property. Selling or listing the property are separate actions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {formInitialData ? (
                            <PropertyForm 
                                mode="edit"
                                onSubmit={handleCoreDetailsSubmit}
                                initialData={formInitialData}
                                isSaving={isSaving}
                                submitButtonText="Save Changes"
                            />
                        ) : <Skeleton className="h-64 w-full" />}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Public Listing Status</CardTitle>
                        <CardDescription>Make this property visible on the public listings page.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                           <Switch
                                id="public-listing-switch"
                                checked={isListedPublicly}
                                onCheckedChange={handleListingToggle}
                            />
                            <Label htmlFor="public-listing-switch">List this property publicly</Label>
                        </div>

                        {isListedPublicly && (
                             <div className="space-y-4 rounded-md border p-4">
                                <div className="space-y-1">
                                    <Label htmlFor="listing-price-unit">Listing Price per {property.landDetails.areaUnit} (₹)</Label>
                                    <Input
                                        id="listing-price-unit"
                                        type="number"
                                        placeholder="e.g. 6000"
                                        value={listingPricePerUnit || ''}
                                        onChange={(e) => setListingPricePerUnit(e.target.valueAsNumber)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Calculated Listing Price</Label>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                        <IndianRupee className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-2xl font-bold">
                                            {new Intl.NumberFormat('en-IN').format(calculatedListingPrice)}
                                        </span>
                                    </div>
                                </div>
                                <Button onClick={handleListingUpdate} disabled={isListingLoading}>
                                    {isListingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Listing Price
                                </Button>
                             </div>
                        )}
                    </CardContent>
                </Card>
            </div>
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

// This is a Server Component responsible for fetching initial data.
export default function PropertyDetailPage({ params }: { params: { propertyId: string } }) {
    // SECURITY NOTE: In a real-world production app, a server-side ownership check
    // would be critical here before rendering the page. This would involve
    // checking the user's session and comparing their ID to the property's `ownerUid`.
    return <PropertyDetailClientPage propertyId={params.propertyId} />;
}

    