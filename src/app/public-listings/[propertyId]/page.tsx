'use client';

import type { Property } from '@/app/(app)/properties/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, query } from 'firebase/firestore';
import { ArrowLeft, BadgeCheck, Building2, Phone, MapPin } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface PublicProperty extends Property {
    media?: { url: string; contentType: string }[];
}

// This is the Client Component that receives the initial data as a prop.
function PublicPropertyDetailClientPage({ initialProperty, propertyId }: { initialProperty: PublicProperty | null, propertyId: string }) {
  const [property] = React.useState<PublicProperty | null>(initialProperty);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (!property) {
      toast({ title: 'Not Found', description: 'This property is not available for public viewing.', variant: 'destructive' });
      router.push('/public-listings'); // Redirect if not found or not public
    }
  }, [property, router, toast]);

  if (!property) {
    // Return a loading or not found state while redirecting
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-4xl space-y-8">
            <Skeleton className="h-16 w-1/2" />
            <Skeleton className="aspect-video w-full" />
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        </div>
      </div>
    );
  }
  
  const imageUrl = property?.media?.[0]?.url || 'https://placehold.co/1200x800.png';
  const imageHint = property?.media?.[0]?.url ? 'property interior' : 'property exterior';

  const handleContactAgent = () => {
    toast({
      title: 'Contact Agent',
      description: 'Functionality to contact the agent would be implemented here.',
    });
  };

  const formatAreaUnit = (unit?: 'Square Feet' | 'Acre') => {
    if (unit === 'Square Feet') return 'sq.ft.';
    if (unit) return unit;
    return '';
  };
  
  const pricePerUnit = property.listingPrice && property.landDetails.area > 0 ? (property.listingPrice / property.landDetails.area) : 0;

  return (
    <div className="bg-background min-h-screen">
       <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center">
           <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="ml-4">
                <h1 className="text-xl font-semibold">{property.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {property.address.city}, {property.address.state}
                </p>
            </div>
        </div>
      </header>

      <main className="container mx-auto p-4 lg:p-6 space-y-8 mt-6">
        <div className="w-full h-64 md:h-96 relative rounded-lg overflow-hidden border">
            <Image 
                src={imageUrl}
                alt={`Photo of ${property.name}`}
                fill
                style={{objectFit: 'cover'}}
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={imageHint}
            />
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Property Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 text-center">
                         <div className="space-y-1 p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Property Type</p>
                            <p className="text-md font-medium flex items-center justify-center gap-1.5"><Building2 className="h-5 w-5 text-primary" />{property.propertyType}</p>
                        </div>
                        <div className="space-y-1 p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Area</p>
                            <p className="text-md font-medium flex items-center justify-center gap-1.5">{property.landDetails.area} {formatAreaUnit(property.landDetails.areaUnit)}</p>
                        </div>
                        <div className="space-y-1 p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="text-md font-medium flex items-center justify-center gap-1.5"><BadgeCheck className="h-5 w-5 text-green-500" />Ready for Sale</p>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            {property.remarks || 'No additional description provided for this property. Please contact the agent for more details.'}
                        </p>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                 <Card className="sticky top-24">
                    <CardHeader>
                        <CardTitle>Pricing Details</CardTitle>
                        <CardDescription>All prices are in Indian Rupees.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-foreground">
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(property.listingPrice || 0)}
                            </p>
                        </div>
                        {pricePerUnit > 0 && (
                            <p className="text-sm text-muted-foreground">
                                Rate: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pricePerUnit)} per {formatAreaUnit(property.landDetails.areaUnit)}
                            </p>
                        )}
                        <Button size="lg" className="w-full mt-4" onClick={handleContactAgent}>
                            <Phone className="mr-2 h-4 w-4" /> Contact Agent
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>

      </main>
    </div>
  );
}

// --- The Server Component ---
// This is the default export for the page. It is NOT a client component.
// Its only job is to handle the server-side `params` object and fetch initial data.
export default async function PublicPropertyDetailPage({ params }: { params: { propertyId: string } }) {
    
    const fetchPublicProperty = async (id: string): Promise<PublicProperty | null> => {
        if (!db || !id) return null;
        try {
            const propDocRef = doc(db, 'properties', id);
            const docSnap = await getDoc(propDocRef);

            if (docSnap.exists() && docSnap.data().isListedPublicly) {
                const propertyData = { id: docSnap.id, ...docSnap.data() } as Property;
                
                const mediaCollectionRef = collection(db, 'properties', docSnap.id, 'media');
                const mediaSnapshot = await getDocs(query(mediaCollectionRef));
                const media = mediaSnapshot.docs.map(mediaDoc => mediaDoc.data() as { url: string; contentType: string });

                return { ...propertyData, media };
            }
            return null;
        } catch (error) {
            console.error("Error fetching public property details:", error);
            return null;
        }
    }

    const { propertyId } = await params;
    const initialProperty = await fetchPublicProperty(propertyId);

    return (
      <PublicPropertyDetailClientPage propertyId={propertyId} initialProperty={initialProperty} />
    );
}
