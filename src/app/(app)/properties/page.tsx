
'use client'

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { Building, Edit, Eye, Filter, Loader2, MoreHorizontal, Plus, Search, Trash, History, Building2 } from 'lucide-react'
import * as React from 'react'

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { useAuth } from '@/app/(app)/layout'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface Property {
  id: string
  name: string
  address: {
    street: string
    city: string
    state: string
    zip: string
    landmark?: string
    latitude?: number
    longitude?: number
  }
  landDetails: {
    khasraNumber?: string
    landbookNumber?: string
    area: number
    areaUnit: 'Square Feet' | 'Acre'
  }
  propertyType: 'Open Land' | 'Flat' | 'Villa' | 'Commercial Complex Unit' | 'Apartment'
  purchaseDate: Timestamp
  purchasePrice: number
  remarks?: string
  ownerUid: string
  status: 'Owned' | 'For Sale' | 'Sold'
  landType?: 'Agricultural' | 'Residential' | 'Commercial' | 'Tribal'
  isDiverted?: boolean
  isListedPublicly?: boolean
  listingPrice?: number
  soldPrice?: number
  soldDate?: Timestamp
  listingPricePerUnit?: number
  purchasePricePerUnit?: number;
}

const PropertyCard = React.memo(({ property, onDelete }: { property: Property; onDelete: (p: Property) => void }) => {
  const router = useRouter()
  return (
    <Card 
        className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => router.push(`/properties/${property.id}`)}
    >
      <div className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
        <CardHeader>
          <CardTitle className="text-lg line-clamp-1">{property.name}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {property.propertyType}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-20">
          <p className="text-sm text-muted-foreground">{property.address.street}, {property.address.city}</p>
          <p className="text-sm text-muted-foreground mt-2">Area: {property.landDetails.area} {property.landDetails.areaUnit}</p>
        </CardContent>
      </div>
      <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
        <Badge
          className={cn(
            'font-semibold',
            property.status === 'For Sale' && 'bg-primary text-primary-foreground',
            property.status === 'Sold' && 'bg-chart-2 text-primary-foreground',
            property.status === 'Owned' && 'bg-[#644117] text-white hover:bg-[#644117]/90'
          )}
        >
          {property.status}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push(`/properties/${property.id}`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit / View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(property)} className="text-destructive focus:text-destructive">
              <Trash className="mr-2 h-4 w-4" /> Delete Property
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )
})
PropertyCard.displayName = 'PropertyCard'

const PageSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
      <Card key={i} className="flex flex-col">
        <div className="flex-grow p-6 space-y-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <CardFooter className="bg-muted/50 p-4 flex justify-between items-center border-t">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-20" />
        </CardFooter>
      </Card>
    ))}
  </div>
)

export default function PropertiesPage() {
  const { user } = useAuth()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('All')
  const [typeFilter, setTypeFilter] = React.useState('All')

  React.useEffect(() => {
    if (!user || !db) {
      setProperties([])
      setLoading(false)
      return
    }

    setLoading(true)
    let q = query(collection(db, 'properties'), where('ownerUid', '==', user.uid))
    if (statusFilter !== 'All') {
      q = query(q, where('status', '==', statusFilter))
    }
     if (typeFilter !== 'All') {
      q = query(q, where('propertyType', '==', typeFilter))
    }

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Property, 'id'>
          props.push({ id: doc.id, ...data })
        })
        setProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching properties: ', error)
        toast({ title: 'Error', description: 'Failed to fetch properties.', variant: 'destructive' })
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [user, toast, statusFilter, typeFilter])

  const handleDeleteProperty = React.useCallback((property: Property) => {
    setSelectedProperty(property)
    setIsDeleteAlertOpen(true)
  }, [])

  const confirmDelete = async () => {
    if (!selectedProperty || !db) return

    try {
      await deleteDoc(doc(db!, 'properties', selectedProperty.id))
      toast({ title: 'Success', description: 'Property deleted successfully.' })
    } catch (error) {
      console.error('Error deleting document: ', error)
      toast({ title: 'Error', description: 'Failed to delete property.', variant: 'destructive' })
    } finally {
      setIsDeleteAlertOpen(false)
      setSelectedProperty(null)
    }
  }

  const filteredProperties = React.useMemo(() => {
    return properties.filter(prop =>
      prop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.address.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.address.street.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
  }, [properties, searchTerm]);
  
  const propertyTypes = ['Open Land', 'Flat', 'Villa', 'Commercial Complex Unit', 'Apartment'];
  const propertyStatuses = ['Owned', 'For Sale', 'Sold'];

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-grow">
            <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground">Manage your portfolio of properties.</p>
          </div>
          <Button onClick={() => router.push('/properties/new')}>
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Button>
        </div>
        
        <Card>
            <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <Input
                            placeholder="Search by name, city, or locality..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            {propertyStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Types</SelectItem>
                            {propertyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>


        {loading ? (
          <PageSkeleton />
        ) : filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProperties.map((prop) => (
              <PropertyCard key={prop.id} property={prop} onDelete={handleDeleteProperty} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Building className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-muted-foreground">No Properties Found</h2>
            <p className="mt-2 text-muted-foreground">{db ? 'Add a new property to get started.' : 'Firebase not configured. Please check your environment.'}</p>
          </div>
        )}
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the property.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProperty(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
