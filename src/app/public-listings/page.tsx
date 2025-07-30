
'use client';

import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Building2, Globe, MapPin } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import type { Property } from '@/app/(app)/properties/page';
import { useToast } from '@/hooks/use-toast';

const PublicPropertyCard = React.memo(({ property }: { property: Property }) => {
  const { toast } = useToast();

  const handleContactAgent = () => {
    toast({
      title: 'Contact Agent',
      description: 'Functionality to contact the agent would be implemented here.',
    });
  };

  if (!property.listingPrice) return null;

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
        <div className="flex-grow flex flex-col rounded-t-lg">
            <CardHeader>
                <CardTitle className="text-lg">{property.name}</CardTitle>
                <CardDescription className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {`${property.address.street}, ${property.address.city}`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{property.propertyType}</span>
                </div>
                 <div className="text-sm text-muted-foreground">
                    Size: {`${property.landDetails.area} ${property.landDetails.areaUnit}`}
                 </div>
            </CardContent>
        </div>
        <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
            <div>
                <p className="text-muted-foreground">Asking Price</p>
                <p className="font-semibold text-base">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(property.listingPrice)}</p>
            </div>
            <Button size="sm" onClick={handleContactAgent}>
                Contact Agent
            </Button>
        </CardFooter>
    </Card>
  );
});
PublicPropertyCard.displayName = "PublicPropertyCard";


const PageSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
            <Card key={i} className="flex flex-col">
                <div className="flex-grow p-6 space-y-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="space-y-2 pt-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </div>
                </div>
                <CardFooter className="bg-muted/50 p-4 flex justify-between items-center border-t">
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-28" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                </CardFooter>
            </Card>
        ))}
    </div>
);

function PublicListingsContent({ ownerId }: { ownerId: string | null }) {
  const [properties, setProperties] = React.useState<Property[]>([]);
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

    getDoc(userDocRef).then(userDoc => {
      if (userDoc.exists() && userDoc.data().publicListingsEnabled) {
        setPageState('enabled');
        setOwnerName(userDoc.data().displayName || 'Property Manager');

        const q = query(
          collection(db, 'properties'),
          where('ownerUid', '==', ownerId),
          where('isListedPublicly', '==', true)
        );
        
        unsubscribeProperties = onSnapshot(
          q,
          (querySnapshot) => {
            const props: Property[] = [];
            querySnapshot.forEach((doc) => {
              props.push({ id: doc.id, ...doc.data() } as Property);
            });
            setProperties(props);
          },
          (error) => {
            console.error('Error fetching public properties: ', error);
            setPageState('disabled');
          }
        );
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
           <Link href="#" className="flex items-center gap-2 text-xl font-semibold pointer-events-none">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <span>{ownerName}</span>
           </Link>
        </div>
      </header>
      <main className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-grow">
              <h1 className="text-3xl font-bold tracking-tight">Available Properties</h1>
              <p className="text-muted-foreground">Browse our current selection of publicly listed properties.</p>
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


export default function PublicListingsPage({ searchParams }: { searchParams?: { owner?: string } }) {
    const resolvedSearchParams = React.use(searchParams);
    const ownerId = resolvedSearchParams?.owner || null;

    return (
        <React.Suspense fallback={<PageSkeleton />}>
            <PublicListingsContent ownerId={ownerId} />
        </React.Suspense>
    );
}

