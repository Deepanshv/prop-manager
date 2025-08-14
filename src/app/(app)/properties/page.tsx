
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { collection, deleteDoc, doc, onSnapshot, query, Timestamp, updateDoc, where, setDoc, addDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, CheckCircle, Loader2, MoreHorizontal, Plus, Trash, Edit } from 'lucide-react'
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
import { Building, MapPin } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'


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
  propertyType: 'Open Land' | 'Flat' | 'Villa' | 'Commercial Complex Unit' | 'Apartment'
  purchaseDate: Timestamp
  purchasePrice: number
  listingPrice?: number
  isListedPublicly?: boolean
  status?: 'Owned' | 'For Sale' | 'Sold'
  soldPrice?: number
  soldDate?: Timestamp
  remarks?: string
  landType?: 'Agricultural' | 'Residential' | 'Commercial' | 'Tribal'
  isDiverted?: boolean
}


const propertyTypes = ['Open Land', 'Flat', 'Villa', 'Commercial Complex Unit', 'Apartment'];
const landAreaUnits = ['Square Feet', 'Acre'];

const addPropertyFormSchema = z.object({
  name: z.string().min(3, 'Property name must be at least 3 characters.'),
  address: z.object({
    street: z.string().min(1, 'Area/Locality is required'),
    city: z.string().min(1, 'City is required.'),
    state: z.string().min(1, 'State is required.'),
    zip: z.string().min(6, 'A 6-digit zip code is required.').max(6, 'A 6-digit zip code is required.'),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  purchaseDate: z.date({ required_error: 'A purchase date is required.' }),
  landDetails: z.object({
      area: z.coerce.number({invalid_type_error: "Area must be a number"}).min(0.0001, "Land area must be greater than 0."),
      areaUnit: z.string({ required_error: "Please select a unit." }),
  }),
  purchasePrice: z.coerce.number().positive("Purchase price must be positive."),
  remarks: z.string().optional(),
});
type AddPropertyFormData = z.infer<typeof addPropertyFormSchema>;

const PropertyCard = React.memo(({ property, onDelete, onMarkAsSold, onEdit }: { property: Property, onDelete: (p: Property) => void, onMarkAsSold: (p: Property) => void, onEdit: (p: Property) => void }) => {
    const router = useRouter();
    return (
        <Card 
            className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push(`/properties/${property.id}`)}
        >
            <div className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
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
            </div>
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
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onEdit(property)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Details
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
  const router = useRouter()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [isSoldModalOpen, setIsSoldModalOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)
  
  const { toast } = useToast()

  const soldForm = useForm<MarkAsSoldFormData>({
    resolver: zodResolver(markAsSoldSchema),
  });

  const addPropertyForm = useForm<AddPropertyFormData>({
    resolver: zodResolver(addPropertyFormSchema),
    defaultValues: {
      name: '',
      address: { street: '', city: '', state: '', zip: '' },
      landDetails: { area: 1, areaUnit: 'Square Feet' },
      purchaseDate: new Date(),
      remarks: '',
      propertyType: 'Open Land',
      purchasePrice: 1,
    }
  })

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
    addPropertyForm.reset();
    setIsAddModalOpen(true)
  }
  
  const handleEditProperty = React.useCallback((property: Property) => {
    router.push(`/properties/${property.id}`);
  }, [router]);

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

  const onAddSubmit = async (data: AddPropertyFormData) => {
    if (!user || !db) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    
    try {
        await addDoc(collection(db, 'properties'), {
          ...data,
          purchaseDate: Timestamp.fromDate(data.purchaseDate),
          ownerUid: user.uid,
          status: 'Owned',
        });
        
        toast({ title: 'Success', description: 'Property added successfully.' });
        setIsAddModalOpen(false);

    } catch (error: any) {
        console.error('Error during property creation: ', error);
        toast({ title: 'Error', description: error.message || 'Failed to save property. Please try again.', variant: 'destructive' });
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
            isListedPublicly: false,
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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Property Manager</h1>
          <Button onClick={handleAddProperty}>
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Button>
        </div>

        {loading ? <PageSkeleton /> : properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((prop) => (
                    <PropertyCard key={prop.id} property={prop} onDelete={handleDeleteProperty} onMarkAsSold={handleMarkAsSold} onEdit={handleEditProperty} />
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
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>Fill in the details to add a new property.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto pr-4 pt-4">
             <Form {...addPropertyForm}>
              <form onSubmit={addPropertyForm.handleSubmit(onAddSubmit)} className="space-y-8">
                <FormField control={addPropertyForm.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Property Name</FormLabel>
                        <FormControl><Input placeholder="e.g. My Mumbai Flat" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={addPropertyForm.control} name="address.street" render={({ field }) => (
                      <FormItem><FormLabel>Area / Locality</FormLabel><FormControl><Input placeholder="e.g. Juhu" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={addPropertyForm.control} name="address.city" render={({ field }) => (
                      <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g. Mumbai" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={addPropertyForm.control} name="address.state" render={({ field }) => (
                      <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="e.g. Maharashtra" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={addPropertyForm.control} name="address.zip" render={({ field }) => (
                      <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="e.g. 400049" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                    <FormField control={addPropertyForm.control} name="propertyType" render={({ field }) => (
                        <FormItem><FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {propertyTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={addPropertyForm.control} name="purchaseDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Purchase Date</FormLabel>
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
                    <FormField control={addPropertyForm.control} name="landDetails.areaUnit" render={({ field }) => (
                        <FormItem><FormLabel>Area Unit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {landAreaUnits.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={addPropertyForm.control} name="landDetails.area" render={({ field }) => (
                        <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={addPropertyForm.control} name="purchasePrice" render={({ field }) => (
                      <FormItem className="md:col-span-2"><FormLabel>Total Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
                  )}/>
                 </div>
                 <FormField control={addPropertyForm.control} name="remarks" render={({ field }) => (
                      <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Add any other relevant details..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addPropertyForm.formState.isSubmitting}>
                      {addPropertyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Property
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
