
'use client';

import { collection, doc, getDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Building2, Globe, MapPin, IndianRupee, BadgeCheck, Phone } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import type { Property } from '@/app/(app)/properties/page';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface PublicProperty extends Property {
    media?: { url: string; contentType: string }[];
}

const PublicPropertyCard = React.memo(({ property }: { property: PublicProperty }) => {
  const { toast } = useToast();

  const handleContactAgent = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent navigation
    toast({
      title: 'Contact Agent',
      description: 'Functionality to contact the agent would be implemented here.',
    });
  };

  if (!property.listingPrice) return null;
  
  const pricePerUnit = property.listingPricePerUnit || (property.landDetails.area > 0 ? (property.listingPrice / property.landDetails.area) : 0);

  const formatAreaUnit = (unit?: 'Square Feet' | 'Acre') => {
    if (unit === 'Square Feet') return 'sq.ft.';
    return unit || '';
  };
  
  const imageUrl = property.media?.[0]?.url || 'https://placehold.co/600x400.png';
  const imageHint = property.media?.[0]?.url ? 'property exterior' : 'apartment building';


  return (
    <Link href={`/public-listings/${property.id}`} className="block h-full">
      <Card className="flex flex-col overflow-hidden group hover:shadow-lg transition-shadow duration-300 rounded-lg border h-full">
          <div className="relative">
              <Image 
                  src={imageUrl} 
                  alt={property.name} 
                  width={600} 
                  height={400} 
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  data-ai-hint={imageHint}
              />
              <Badge variant="secondary" className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm">For Sale</Badge>
          </div>
        
          <CardContent className="p-4 flex-grow flex flex-col justify-between">
              <div>
                  <h3 className="text-lg font-semibold text-foreground truncate">{property.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <MapPin className="h-4 w-4" />
                      {property.address.city}, {property.address.state}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-b py-3">
                      <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Property Type</p>
                          <p className="text-sm font-medium flex items-center justify-center gap-1.5"><Building2 className="h-4 w-4" />{property.propertyType}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Area</p>
                          <p className="text-sm font-medium flex items-center justify-center gap-1.5">{property.landDetails.area} {formatAreaUnit(property.landDetails.areaUnit)}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="text-sm font-medium flex items-center justify-center gap-1.5"><BadgeCheck className="h-4 w-4 text-green-500" />Ready</p>
                      </div>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-foreground">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(property.listingPrice)}
                      </p>
                      {pricePerUnit > 0 && (
                        <p className="text-sm text-muted-foreground">
                            ({new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pricePerUnit)}/{formatAreaUnit(property.landDetails.areaUnit)})
                        </p>
                      )}
                  </div>
              </div>

              <div className="mt-4">
                  <Button size="lg" className="w-full" onClick={handleContactAgent}>
                      <Phone className="mr-2 h-4 w-4" /> Contact Agent
                  </Button>
              </div>
          </CardContent>
      </Card>
    </Link>
  );
});
PublicPropertyCard.displayName = "PublicPropertyCard";


const PageSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
            <Card key={i} className="flex flex-col overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4 space-y-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex justify-between items-center border-t pt-4">
                         <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-24" />
                         </div>
                        <Skeleton className="h-10 w-32" />
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

function PublicListingsContent({ ownerId }: { ownerId: string | null }) {
  const [properties, setProperties] = React.useState<PublicProperty[]>([]);
  const [pageState, setPageState] = React.useState<'loading' | 'enabled' | 'disabled' | 'invalid'>('loading');
  const [ownerName, setOwnerName] = React.useState('Property Manager');

  React.useEffect(() => {
    if (!db) {
      setPageState('disabled');
      return;
    }
    if (!ownerId) {
      setPageState('invalid');
      return;
    }

    const userDocRef = doc(db, 'users', ownerId);
    let unsubscribeProperties: (() => void) | undefined;

    const fetchPropertiesAndMedia = async () => {
        const q = query(
            collection(db, 'properties'),
            where('ownerUid', '==', ownerId),
            where('isListedPublicly', '==', true)
        );

        unsubscribeProperties = onSnapshot(q, async (querySnapshot) => {
            const propsPromises = querySnapshot.docs.map(async (doc) => {
                const propertyData = { id: doc.id, ...doc.data() } as Property;
                const mediaCollectionRef = collection(db, 'properties', doc.id, 'media');
                const mediaSnapshot = await getDocs(query(mediaCollectionRef));
                const media = mediaSnapshot.docs.map(mediaDoc => mediaDoc.data() as { url: string; contentType: string });
                return { ...propertyData, media };
            });

            const props = await Promise.all(propsPromises);
            setProperties(props);
        }, (error) => {
            console.error('Error fetching public properties: ', error);
            setPageState('disabled');
        });
    };


    getDoc(userDocRef).then(userDoc => {
      if (userDoc.exists() && userDoc.data().publicListingsEnabled) {
        setPageState('enabled');
        setOwnerName(userDoc.data().displayName || 'Property Manager');
        fetchPropertiesAndMedia();
      } else {
        setPageState('disabled');
      }
    }).catch(error => {
      console.error("Error fetching user document:", error);
      setPageState('disabled');
    });

    return () => {
      if (unsubscribeProperties) {
        unsubscribeProperties();
      }
    };
  }, [ownerId]);
  
  const renderContent = () => {
    switch (pageState) {
        case 'loading':
            return <PageSkeleton />;
        case 'invalid':
            return (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold text-muted-foreground">Invalid Link</h2>
                    <p className="mt-2 text-muted-foreground">
                        The link you are using is incomplete. Please use the link provided by the property manager.
                    </p>
                </div>
            );
        case 'disabled':
             return (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold text-muted-foreground">Page Not Available</h2>
                    <p className="mt-2 text-muted-foreground">
                        The owner has disabled this public listings page. Please check back later.
                    </p>
                </div>
            );
        case 'enabled':
            if (properties.length > 0) {
                 return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {properties.map((prop) => (
                          <PublicPropertyCard key={prop.id} property={prop} />
                        ))}
                    </div>
                );
            }
            return (
                 <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold text-muted-foreground">No Public Listings</h2>
                    <p className="mt-2 text-muted-foreground">
                        There are currently no properties available for public viewing.
                    </p>
                </div>
            );
    }
  }


  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2 text-xl font-semibold">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <span>{ownerName}</span>
           </div>
        </div>
      </header>
      <main className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-grow">
              <h1 className="text-3xl font-bold tracking-tight">Available Properties</h1>
          </div>
        </div>
        {renderContent()}
      </main>
      <footer className="bg-card border-t py-6 mt-8">
        <div className="container mx-auto px-4 lg:px-6 text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} Property Manager. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

// This is now a Server Component that unwraps searchParams and passes a primitive prop.
export default function PublicListingsPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    // Correctly unwrap searchParams in a Server Component using React.use()
    const resolvedSearchParams = React.use(searchParams);
    const ownerId = typeof resolvedSearchParams?.owner === 'string' ? resolvedSearchParams.owner : null;

    return (
        <React.Suspense fallback={<PageSkeleton />}>
            <PublicListingsContent ownerId={ownerId} />
        </React.Suspense>
    );
}
