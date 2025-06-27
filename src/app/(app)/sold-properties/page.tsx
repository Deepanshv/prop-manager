
'use client'

import * as React from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { format } from 'date-fns'
import { Building } from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useAuth } from '../layout'
import type { Property } from '../properties/page'


function SoldPropertyCard({ property }: { property: Property }) {
    const formatCurrency = (amount?: number) => {
        if (typeof amount !== 'number') return 'N/A'
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
    }
    const profitLoss = (property.soldPrice || 0) - property.purchasePrice
    
    return (
        <Link href={`/properties/${property.id}`} className="block hover:shadow-lg transition-shadow rounded-lg">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="bg-muted p-3 rounded-md">
                            <Building className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-lg leading-tight">{`${property.address.street}`}</CardTitle>
                            <CardDescription>{`${property.address.city}, ${property.address.state} ${property.address.zip}`}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Purchase Price</p>
                        <p className="font-semibold">{formatCurrency(property.purchasePrice)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Sold Price</p>
                        <p className="font-semibold">{formatCurrency(property.soldPrice)}</p>
                    </div>
                </CardContent>
                <CardFooter className="mt-auto bg-muted/50 p-4 flex justify-between items-center text-sm">
                     <div>
                        <p className="text-muted-foreground">Sold Date</p>
                        <p className="font-semibold">
                            {property.soldDate ? format(property.soldDate.toDate(), 'PPP') : 'N/A'}
                        </p>
                    </div>
                    <div className="text-right">
                       <p className="text-muted-foreground">Profit / Loss</p>
                       <p className={cn(
                            "font-bold text-base",
                            profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                            {formatCurrency(profitLoss)}
                        </p>
                    </div>
                </CardFooter>
            </Card>
        </Link>
    )
}

const PageSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-full flex flex-col">
                 <CardHeader>
                    <div className="flex items-start gap-4">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="space-y-2">
                           <Skeleton className="h-5 w-48" />
                           <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 gap-4 text-sm">
                     <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-24" />
                     </div>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-24" />
                     </div>
                 </CardContent>
                <CardFooter className="mt-auto bg-muted/50 p-4 flex justify-between items-center text-sm">
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-28" />
                    </div>
                     <div className="space-y-1 text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                        <Skeleton className="h-6 w-24 ml-auto" />
                    </div>
                </CardFooter>
            </Card>
        ))}
    </div>
)

export default function SoldPropertiesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [soldProperties, setSoldProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'properties'),
      where('ownerUid', '==', user.uid),
      where('status', '==', 'Sold'),
      orderBy('soldDate', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = []
        querySnapshot.forEach((doc) => {
          props.push({ id: doc.id, ...doc.data() } as Property)
        })
        setSoldProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching sold properties: ', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch sold properties.',
          variant: 'destructive',
        })
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, toast])

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Sold Properties</h1>
        <div className="flex items-center gap-2">
            <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div>
        {loading ? <PageSkeleton /> : (
            soldProperties.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {soldProperties.map((prop) => (
                        <SoldPropertyCard key={prop.id} property={prop} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <h2 className="text-xl font-semibold text-muted-foreground">No Sold Properties Found</h2>
                    <p className="mt-2 text-muted-foreground">When you mark a property as 'Sold', it will appear here.</p>
                </div>
            )
        )}
      </div>
    </main>
  )
}
