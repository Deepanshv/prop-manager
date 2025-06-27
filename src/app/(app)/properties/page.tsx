
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { format } from 'date-fns'
import {
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash,
  View,
} from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useAuth } from '../layout'
import { useRouter } from 'next/navigation'

const propertyTypes = ['Single Family', 'Multi-Family', 'Condo', 'Townhouse', 'Land', 'Other']

const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().min(5, 'A 5-digit zip code is required.'),
})

const propertyFormSchema = z.object({
  address: addressSchema,
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  purchaseDate: z.date({ required_error: 'A purchase date is required.' }),
  purchasePrice: z.coerce.number().min(1, 'Purchase price must be greater than 0.'),
  isListedPublicly: z.boolean().default(false),
})

type PropertyFormData = z.infer<typeof propertyFormSchema>

const markAsSoldSchema = z.object({
    soldPrice: z.coerce.number().min(1, 'Sold price is required.'),
    soldDate: z.date({ required_error: 'A sold date is required.' }),
});
type MarkAsSoldFormData = z.infer<typeof markAsSoldSchema>;


export interface Property {
  id: string
  ownerUid: string
  address: {
    street: string
    city: string
    state: string
    zip: string
  }
  propertyType: string
  purchaseDate: Timestamp
  purchasePrice: number
  isListedPublicly?: boolean
  status?: 'Owned' | 'For Sale' | 'Sold'
  soldPrice?: number
  soldDate?: Timestamp
}

export default function PropertyManagerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [isSoldModalOpen, setIsSoldModalOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)
  const { toast } = useToast()

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
        isListedPublicly: false,
    }
  })

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
        setProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching properties: ', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch properties.',
          variant: 'destructive',
        })
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [user, toast])

  const handleAddProperty = () => {
    form.reset({
      address: { street: '', city: '', state: '', zip: '' },
      purchasePrice: 0,
      isListedPublicly: false,
      propertyType: undefined,
      purchaseDate: undefined,
    })
    setIsModalOpen(true)
  }

  const handleDeleteProperty = (property: Property) => {
    setSelectedProperty(property)
    setIsDeleteAlertOpen(true)
  }
  
  const handleMarkAsSold = (property: Property) => {
    setSelectedProperty(property);
    soldForm.reset({ soldPrice: property.purchasePrice, soldDate: new Date() });
    setIsSoldModalOpen(true);
  };

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

    const propertyData = {
      ...data,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      ownerUid: user.uid,
      status: 'Owned', // Default status on creation
    }

    try {
      await addDoc(collection(db, 'properties'), propertyData)
      toast({ title: 'Success', description: 'Property added successfully.' })
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error writing document: ', error)
      toast({ title: 'Error', description: 'Failed to save property.', variant: 'destructive' })
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


  const TableSkeleton = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  )
  
  const StatusBadge = ({ status }: { status?: Property['status']}) => {
    const s = status || 'Owned';
    const variant: "secondary" | "default" | "outline" = s === 'Sold' ? 'default' : s === 'For Sale' ? 'outline' : 'secondary';
    return <Badge variant={variant}>{s}</Badge>
  }


  return (
    <>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Property Manager</h1>
          <Button onClick={handleAddProperty}>
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Button>
        </div>

        <div className="border shadow-sm rounded-lg">
          <div className="p-4 border-b">
            <Input placeholder="Search by address..." className="max-w-sm" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead>Purchase Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : properties.length > 0 ? (
                properties.map((prop) => (
                  <TableRow key={prop.id}>
                    <TableCell className="font-medium">
                      {`${prop.address.street}, ${prop.address.city}, ${prop.address.state} ${prop.address.zip}`}
                    </TableCell>
                    <TableCell>{prop.propertyType}</TableCell>
                    <TableCell>{format(prop.purchaseDate.toDate(), 'PPP')}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(prop.purchasePrice)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={prop.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/properties/${prop.id}`)}>
                            <View className="mr-2 h-4 w-4" /> View/Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMarkAsSold(prop)}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Sold
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteProperty(prop)} className="text-destructive focus:text-destructive">
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {db ? 'No properties found. Add one to get started!' : 'Firebase not configured. Please add credentials to your environment file.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4 border-t flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                  Showing <strong>1-{properties.length}</strong> of <strong>{properties.length}</strong> properties
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" /> Previous</Button>
                  <Button variant="outline" size="sm" disabled>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
          </div>
        </div>
      </main>

      {/* Add Property Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>
              Fill in the form to add a new property to your portfolio.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address.street"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Street Address</FormLabel>
                      <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input placeholder="Anytown" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input placeholder="CA" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl><Input placeholder="12345" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {propertyTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl><Input type="number" placeholder="250000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col md:col-span-2">
                      <FormLabel>Purchase Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="isListedPublicly"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>List Publicly</FormLabel>
                            <FormDescription>
                            Make this property visible on the public listings page.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                    />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Property
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isSoldModalOpen} onOpenChange={setIsSoldModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Property as Sold</DialogTitle>
            <DialogDescription>
              Enter the final sale price and date for {'"'}
              {selectedProperty && `${selectedProperty.address.street}, ${selectedProperty.address.city}`}
              {'"'}. This action will move the property to your Sales History.
            </DialogDescription>
          </DialogHeader>
          <Form {...soldForm}>
            <form onSubmit={soldForm.handleSubmit(onSoldSubmit)} className="space-y-4 pt-4">
                <FormField
                    control={soldForm.control}
                    name="soldPrice"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Final Sale Price</FormLabel>
                        <FormControl><Input type="number" placeholder="350000" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={soldForm.control}
                    name="soldDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Sale Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsSoldModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={soldForm.formState.isSubmitting}>
                    {soldForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Sale
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the property from your portfolio.
            </AlertDialogDescription>
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
