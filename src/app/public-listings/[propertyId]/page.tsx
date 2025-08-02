
'use client';

import type { Property } from '@/app/(app)/properties/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, BadgeCheck, Building2, Phone, MapPin } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as React from 'react';

function PublicPropertyDetailClientPage({ propertyId }: { propertyId: string }) {
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (!db || !propertyId) {
      setLoading(false);
      return;
    }

    const propDocRef = doc(db, 'properties', propertyId);
    const unsubscribe = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().isListedPublicly) {
        setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
      } else {
        toast({ title: 'Not Found', description: 'This property is not available for public viewing.', variant: 'destructive' });
        router.push('/public-listings'); // Redirect if not found or not public
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching property details:", error);
      toast({ title: 'Error', description: 'Failed to fetch property details.', variant: 'destructive' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [propertyId, router, toast]);

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

  if (loading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-96 w-full rounded-lg" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    // The redirect should handle this, but as a fallback:
    return (
        <div className="flex h-screen items-center justify-center">
            <p>Property not found or not available.</p>
        </div>
    );
  }
  
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
                src="https://placehold.co/1200x800.png"
                alt={`Photo of ${property.name}`}
                fill
                style={{objectFit: 'cover'}}
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="property exterior"
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
                                Rate: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pricePerUnit)} per sq.ft
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

export default function PublicPropertyDetailPage({ params }: { params: { propertyId: string } }) {
    // This is the correct pattern for resolving params in Next.js 14.
    const resolvedParams = React.use(params);
    const { propertyId } = resolvedParams;

    return <PublicPropertyDetailClientPage propertyId={propertyId} />;
}
