
'use client';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Building2 } from 'lucide-react';
import * as React from 'react';
import Image from 'next/image';
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

function PublicPropertyCard({ property }: { property: Property }) {
  const placeholderImage = `https://placehold.co/600x400.png`;
  const { toast } = useToast();

  const handleContactAgent = () => {
    // In a real app, this would open a contact form or show contact info.
    toast({
      title: 'Contact Agent',
      description: 'Functionality to contact the agent would be implemented here.',
    });
  };

  return (
    <Card className="overflow-hidden flex flex-col">
      <CardHeader className="p-0">
        <div className="relative aspect-video">
          <Image
            src={placeholderImage}
            alt={`Image of ${property.name || property.address.street}`}
            fill
            className="object-cover"
            data-ai-hint="house exterior"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-1 flex-grow">
        <CardTitle className="text-lg truncate">{property.name}</CardTitle>
        <p className="text-xl font-semibold">{`₹${property.purchasePrice.toLocaleString('en-IN')}`}</p>
        <CardDescription className="pt-1 truncate">{`${property.address.street}, ${property.address.city}, ${property.address.state}`}</CardDescription>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full" onClick={handleContactAgent}>
          Contact Agent
        </Button>
      </CardFooter>
    </Card>
  );
}

const PageSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
      <Card key={i}>
        <Skeleton className="aspect-video w-full" />
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
        <CardFooter className="p-4">
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    ))}
  </div>
);

export default function PublicListingsPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'properties'), where('isListedPublicly', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = [];
        querySnapshot.forEach((doc) => {
          props.push({ id: doc.id, ...doc.data() } as Property);
        });
        setProperties(props);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching public properties: ', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
           <Link href="/public-listings" className="flex items-center gap-2 text-xl font-semibold">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <span>Property-Manager</span>
           </Link>
           {/* This is a public page, so no auth-related buttons here */}
        </div>
      </header>
      <main className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-grow">
              <h1 className="text-3xl font-bold tracking-tight">Available Properties</h1>
              <p className="text-muted-foreground">Browse our current selection of publicly listed properties.</p>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map((prop) => (
              <PublicPropertyCard key={prop.id} property={prop} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-xl font-semibold text-muted-foreground">No Public Listings</h2>
            <p className="mt-2 text-muted-foreground">
              There are currently no properties available for public viewing. Please check back later.
            </p>
          </div>
        )}
      </main>
      <footer className="bg-card border-t py-6 mt-8">
        <div className="container mx-auto px-4 lg:px-6 text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} Property-Manager. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
