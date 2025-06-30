
'use client'

import * as React from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { format } from 'date-fns'
import { Building, MoreHorizontal, Trash, Undo2, View } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useAuth } from '../layout'
import type { Property } from '../properties/page'


function SoldPropertyCard({ property, onDelete, onMarkAsUnsold }: { property: Property, onDelete: (property: Property) => void, onMarkAsUnsold: (property: Property) => void }) {
    const router = useRouter();
    const formatCurrency = (amount?: number) => {
        if (typeof amount !== 'number') return 'N/A'
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
    }
    const profitLoss = (property.soldPrice || 0) - property.purchasePrice
    
    return (
        <Card className="h-full flex flex-col">
            <Link href={`/properties/${property.id}`} className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="bg-muted p-3 rounded-md">
                            <Building className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-lg leading-tight">{property.name}</CardTitle>
                            <CardDescription>{`${property.address.street}, ${property.address.city}`}</CardDescription>
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
            </Link>
            <CardFooter className="mt-auto bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
                 <div>
                    <p className="text-muted-foreground">Sold Date</p>
                    <p className="font-semibold">
                        {property.soldDate ? format(property.soldDate.toDate(), 'PPP') : 'N/A'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right">
                       <p className="text-muted-foreground">Profit / Loss</p>
                       <p className={cn(
                            "font-bold text-base",
                            profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                            {formatCurrency(profitLoss)}
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/properties/${property.id}`)}>
                                <View className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMarkAsUnsold(property)}>
                                <Undo2 className="mr-2 h-4 w-4" /> Mark as Unsold
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDelete(property)} className="text-destructive focus:text-destructive">
                                <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardFooter>
        </Card>
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
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [isUnsoldAlertOpen, setIsUnsoldAlertOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)
  const [selectedYear, setSelectedYear] = React.useState('all');

  React.useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'properties'),
      where('ownerUid', '==', user.uid),
      where('status', '==', 'Sold')
    )

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = []
        querySnapshot.forEach((doc) => {
          props.push({ id: doc.id, ...doc.data() } as Property)
        })
        props.sort((a, b) => {
            const dateA = a.soldDate ? a.soldDate.toDate().getTime() : 0;
            const dateB = b.soldDate ? b.soldDate.toDate().getTime() : 0;
            return dateB - dateA;
        });
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

  const availableYears = React.useMemo(() => {
      if (soldProperties.length === 0) return [];
      const years = new Set(soldProperties.map(p => 
          p.soldDate ? p.soldDate.toDate().getFullYear().toString() : ''
      ));
      return Array.from(years).filter(Boolean).sort((a,b) => parseInt(b) - parseInt(a));
  }, [soldProperties]);

  const filteredProperties = React.useMemo(() => {
      if (selectedYear === 'all') {
          return soldProperties;
      }
      return soldProperties.filter(p => 
          p.soldDate && p.soldDate.toDate().getFullYear().toString() === selectedYear
      );
  }, [soldProperties, selectedYear]);

  
  const handleDeleteProperty = (property: Property) => {
    setSelectedProperty(property);
    setIsDeleteAlertOpen(true);
  };

  const handleMarkAsUnsold = (property: Property) => {
    setSelectedProperty(property);
    setIsUnsoldAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProperty || !db) return;

    try {
      await deleteDoc(doc(db, 'properties', selectedProperty.id));
      toast({ title: 'Success', description: 'Property deleted permanently.' });
    } catch (error) {
      console.error('Error deleting document: ', error);
      toast({ title: 'Error', description: 'Failed to delete property.', variant: 'destructive' });
    } finally {
      setIsDeleteAlertOpen(false);
      setSelectedProperty(null);
    }
  };

  const confirmUnsold = async () => {
    if (!selectedProperty || !db) return;

    try {
      const propDocRef = doc(db, 'properties', selectedProperty.id);
      await updateDoc(propDocRef, {
        status: 'Owned',
        soldPrice: null,
        soldDate: null,
      });
      toast({ title: 'Success', description: 'Property marked as unsold and moved to Properties.' });
    } catch (error) {
      console.error('Error updating document: ', error);
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' });
    } finally {
      setIsUnsoldAlertOpen(false);
      setSelectedProperty(null);
    }
  };

  return (
    <>
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Sold Properties</h1>
        <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={availableYears.length === 0}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div>
        {loading ? <PageSkeleton /> : (
            filteredProperties.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProperties.map((prop) => (
                        <SoldPropertyCard key={prop.id} property={prop} onDelete={handleDeleteProperty} onMarkAsUnsold={handleMarkAsUnsold} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <h2 className="text-xl font-semibold text-muted-foreground">No Sold Properties Found</h2>
                    <p className="mt-2 text-muted-foreground">{selectedYear !== 'all' ? `No properties were sold in ${selectedYear}.` : "When you mark a property as 'Sold', it will appear here."}</p>
                </div>
            )
        )}
      </div>
    </main>

    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. This will permanently delete the property record.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedProperty(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={isUnsoldAlertOpen} onOpenChange={setIsUnsoldAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This action will mark the property as unsold and move it back to your active properties list.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedProperty(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmUnsold}>Yes, Mark as Unsold</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
