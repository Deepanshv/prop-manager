
'use client'

import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { Building2 } from 'lucide-react'
import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'

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

function PropertyCard({ property }: { property: Property }) {
    // A simple placeholder image generator
    const placeholderImage = `https://placehold.co/600x400.png`
    return (
        <Card className="overflow-hidden">
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
            <CardContent className="p-4 space-y-1">
                <CardTitle className="text-lg truncate">{property.name}</CardTitle>
                <p className="text-xl font-semibold">{`₹${property.purchasePrice.toLocaleString('en-IN')}`}</p>
                <CardDescription className="pt-1 truncate">{`${property.address.street}, ${property.address.city}, ${property.address.state}`}</CardDescription>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                 <Button className="w-full" asChild>
                     <Link href={`/login`}>Contact Agent</Link>
                 </Button>
            </CardFooter>
        </Card>
    )
}

const PageSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
            <Card key={i}>
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardContent>
                <CardFooter className="p-4">
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
        ))}
    </div>
)

export default function PublicListingsPage() {
    const [properties, setProperties] = React.useState<Property[]>([])
    const [loading, setLoading] = React.useState(true)

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

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <span className="text-lg font-semibold text-foreground">Property-Manager</span>
                    </Link>
                    <Button asChild>
                        <Link href="/login">Sign In</Link>
                    </Button>
                </div>
            </header>
            <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Available Properties</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                        Browse our curated selection of investment properties available for purchase.
                    </p>
                </div>

                {loading ? <PageSkeleton /> : (
                    properties.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {properties.map((prop) => (
                                <PropertyCard key={prop.id} property={prop} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <h2 className="text-2xl font-semibold">No public listings available.</h2>
                            <p className="mt-2 text-muted-foreground">Please check back later for new investment opportunities.</p>
                        </div>
                    )
                )}
            </main>
             <footer className="border-t py-6">
                <div className="container mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} Property-Manager. All Rights Reserved.
                </div>
            </footer>
        </div>
    )
}
