
'use client'

import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { Building2, Copy, MapPin } from 'lucide-react'
import * as React from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/firebase'
import type { Property } from '@/app/(app)/properties/page'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

function PropertyCard({ property }: { property: Property }) {
    if (!property.listingPrice) return null;

    return (
    <Card className="flex flex-col border-t-4 border-primary">
        <Link href={`/properties/${property.id}`} className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
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
        </Link>
        <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
            <div>
                <p className="text-muted-foreground">Listing Price</p>
                <p className="font-semibold text-base">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(property.listingPrice)}</p>
            </div>
            <Button size="sm" asChild>
                <Link href={`/properties/${property.id}`}>View Details</Link>
            </Button>
        </CardFooter>
    </Card>
  )
}

const PageSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
)

export default function InternalListingsPage() {
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [publicUrl, setPublicUrl] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    // This effect runs on the client-side, where window is available
    setPublicUrl(`${window.location.origin}/public-listings`);
  }, []);

  React.useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    const q = query(collection(db, 'properties'), where('isListedPublicly', '==', true))

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = []
        querySnapshot.forEach((doc) => {
          props.push({ id: doc.id, ...doc.data() } as Property)
        })
        setProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching public properties: ', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const copyPublicLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast({
        title: 'Link Copied!',
        description: 'The public listings page URL has been copied to your clipboard.',
      });
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-grow">
            <h1 className="text-3xl font-bold tracking-tight">Public Listings</h1>
            <p className="text-muted-foreground">This is your internal view of properties marked as "List Publicly".</p>
        </div>
         <Button onClick={copyPublicLink} disabled={!publicUrl}>
            <Copy className="mr-2 h-4 w-4" /> Copy Shareable Link
        </Button>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {properties.map((prop) => (
            <PropertyCard key={prop.id} property={prop} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
           <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-muted-foreground">No Public Listings</h2>
          <p className="mt-2 text-muted-foreground">
            To see properties here, go to a property's details page and enable the "List Publicly" switch.
          </p>
        </div>
      )}
    </main>
  )
}
