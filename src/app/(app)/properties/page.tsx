
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { collection, deleteDoc, doc, onSnapshot, query, Timestamp, updateDoc, where, setDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, CheckCircle, Loader2, MoreHorizontal, Plus, Trash, View, Building, MapPin } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useAuth } from '../layout'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PropertyForm, type PropertyFormData } from '@/components/property-form'


const markAsSoldSchema = z.object({
    soldPrice: z.coerce.number().min(1, 'Sold price is required.'),
    soldDate: z.date({ required_error: 'A sold date is required.' }),
});
type MarkAsSoldFormData = z.infer<typeof markAsSoldSchema>;

export interface Property {
  id: string
  name: string
  ownerUid: string
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
  propertyType: 'Agricultural' | 'Commercial' | 'Residential' | 'Tribal'
  purchaseDate: Timestamp
  purchasePrice: number
  pricePerUnit?: number
  listingPrice?: number
  listingPricePerUnit?: number
  isListedPublicly?: boolean
  status?: 'Owned' | 'For Sale' | 'Sold'
  soldPrice?: number
  soldDate?: Timestamp
  remarks?: string
}

const PropertyCard = React.memo(({ property, onDelete, onMarkAsSold }: { property: Property, onDelete: (p: Property) => void, onMarkAsSold: (p: Property) => void }) => {
    const router = useRouter();

    return (
        <Card className="flex flex-col hover:shadow-lg transition-shadow">
            <Link href={`/properties/${property.id}`} className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
                <CardHeader>
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {`${property.address.street}, ${property.address.city}`}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>{property.propertyType}</span>
                    </div>
                     <div className="text-sm text-muted-foreground">
                        Purchased on {format(property.purchaseDate.toDate(), 'PPP')}
                     </div>
                </CardContent>
            </Link>
            <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
                <div>
                    <p className="text-muted-foreground">Purchase Price</p>
                    <p className="font-semibold text-base">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(property.purchasePrice)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge
                        className={cn(
                            (property.status === 'Owned' || !property.status) && 'bg-[#644117] text-white hover:bg-[#644117]/90',
                            property.status === 'For Sale' && 'bg-primary text-primary-foreground hover:bg-primary/80'
                        )}
                    >
                        {property.status || 'Owned'}
                    </Badge>
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
                            <View className="mr-2 h-4 w-4" /> View/Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMarkAsSold(property)}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Sold
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
});
PropertyCard.displayName = "PropertyCard";

export default function PropertyManagerPage() {
  const { user } = useAuth()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [isSoldModalOpen, setIsSoldModalOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()

  const soldForm = useForm<MarkAsSoldFormData>({
    resolver: zodResolver(markAsSoldSchema),
  });

  React.useEffect(() => {
    if (!user || !db) {
      setProperties([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(collection(db, 'properties'), where('ownerUid', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = []
        querySnapshot.forEach((doc) => {
          const propertyData = { id: doc.id, ...doc.data() } as Property
          if (propertyData.status !== 'Sold') {
            props.push(propertyData)
          }
        })
        setProperties(props.sort((a, b) => b.purchaseDate.toDate().getTime() - a.purchaseDate.toDate().getTime()))
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching properties: ', error)
        toast({ title: 'Error', description: 'Failed to fetch properties.', variant: 'destructive' })
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [user, toast])
  
  
  const handleAddProperty = () => {
    setIsModalOpen(true)
  }

  const handleDeleteProperty = React.useCallback((property: Property) => {
    setSelectedProperty(property)
    setIsDeleteAlertOpen(true)
  }, []);
  
  const handleMarkAsSold = React.useCallback((property: Property) => {
    setSelectedProperty(property);
    soldForm.reset({ soldPrice: property.listingPrice || property.purchasePrice, soldDate: new Date() });
    setIsSoldModalOpen(true);
  }, [soldForm]);

  const confirmDelete = async () => {
    if (!selectedProperty || !db) return
      
    try {
      await deleteDoc(doc(db, 'properties', selectedProperty.id))
      toast({ title: 'Success', description: 'Property deleted successfully.' })
    } catch (error) {
      console.error('Error deleting document: ', error)
      toast({ title: 'Error', description: 'Failed to delete property.', variant: 'destructive' })
    } finally {
      setIsDeleteAlertOpen(false)
      setSelectedProperty(null)
    }
  }

  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !db) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true);
    
    try {
        const newPropertyRef = doc(collection(db, 'properties'));
        const propertyData = {
          ...data,
          purchaseDate: Timestamp.fromDate(data.purchaseDate),
          ownerUid: user.uid,
          status: 'Owned' as const,
          soldPrice: null,
          soldDate: null,
          remarks: data.remarks ?? null,
          pricePerUnit: data.pricePerUnit ?? null,
          listingPrice: data.isListedPublicly ? (data.listingPrice ?? null) : null,
          listingPricePerUnit: data.isListedPublicly ? (data.listingPricePerUnit ?? null) : null,
          address: {
            ...data.address,
            landmark: data.address.landmark ?? null,
            latitude: data.address.latitude ?? null,
            longitude: data.address.longitude ?? null,
          },
          landDetails: {
            ...data.landDetails,
            khasraNumber: data.landDetails.khasraNumber ?? null,
            landbookNumber: data.landDetails.landbookNumber ?? null,
          },
        };
        
        await setDoc(newPropertyRef, propertyData);
        
        toast({ title: 'Success', description: 'Property added successfully. You can add documents in the edit screen.' });
        setIsModalOpen(false);

    } catch (error: any) {
        console.error('Error during property creation: ', error);
        toast({ title: 'Error', description: error.message || 'Failed to save property. Please try again.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  const onSoldSubmit = async (data: MarkAsSoldFormData) => {
    if (!selectedProperty || !db || !user) {
        toast({ title: 'Error', description: 'Cannot update property.', variant: 'destructive' });
        return;
    }

    try {
        const propDocRef = doc(db, 'properties', selectedProperty.id);
        await updateDoc(propDocRef, {
            status: 'Sold',
            soldPrice: data.soldPrice,
            soldDate: Timestamp.fromDate(data.soldDate),
        });
        toast({ title: 'Success', description: 'Property marked as sold and moved to Sales History.' });
        setIsSoldModalOpen(false);
        setSelectedProperty(null);
    } catch (error) {
        console.error('Error updating document: ', error);
        toast({ title: 'Error', description: 'Failed to mark property as sold.', variant: 'destructive' });
    }
  };

  const PageSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
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

  return (
    <>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Property Manager</h1>
          <Button onClick={handleAddProperty}>
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Button>
        </div>

        {loading ? <PageSkeleton /> : properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((prop) => (
                    <PropertyCard key={prop.id} property={prop} onDelete={handleDeleteProperty} onMarkAsSold={handleMarkAsSold} />
                ))}
            </div>
        ) : (
             <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h2 className="text-xl font-semibold text-muted-foreground">No Properties Found</h2>
                <p className="mt-2 text-muted-foreground">
                    {db ? 'Add a new property to get started!' : 'Firebase not configured. Please check your environment.'}
                </p>
            </div>
        )}
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>Fill in the details to add a new property. Documents can be added after creation.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto pr-4 pt-4">
            <PropertyForm
                mode="add"
                onSubmit={onSubmit}
                isSaving={isSaving}
                submitButtonText="Save Property"
            >
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            </PropertyForm>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isSoldModalOpen} onOpenChange={(open) => {
          setIsSoldModalOpen(open);
          if (!open) {
              setSelectedProperty(null);
          }
      }}>
        <DialogContent className="sm:max-w-md">
          {selectedProperty ? (
            <>
              <DialogHeader>
                <DialogTitle>Mark Property as Sold</DialogTitle>
                <DialogDescription>
                  Enter the final sale price and date for &quot;
                  {selectedProperty.name}
                  &quot;. This action will move the property to your Sales History.
                </DialogDescription>
              </DialogHeader>
              <Form {...soldForm}>
                <form onSubmit={soldForm.handleSubmit(onSoldSubmit)} className="space-y-4 pt-4">
                    <FormField control={soldForm.control} name="soldPrice" render={({ field }) => (
                        <FormItem><FormLabel>Final Sale Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={soldForm.control} name="soldDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Sale Date</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                        <FormMessage />
                        </FormItem>
                    )}/>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsSoldModalOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={soldForm.formState.isSubmitting}>
                        {soldForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Sale
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the property from your portfolio.</AlertDialogDescription>
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
