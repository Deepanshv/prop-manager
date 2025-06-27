
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { ArrowLeft, Calendar as CalendarIcon, FileQuestion, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { FileManager } from '@/components/file-manager'
import { useAuth } from '../../layout'
import type { Property } from '../page'

const indianStates = [ 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry' ];
const propertyTypes = ['Agricultural', 'Commercial', 'Residential', 'Tribal'];
const landAreaUnits = ['Square Feet', 'Acre'];
const propertyStatuses = ['Owned', 'For Sale', 'Sold'];

const addressSchema = z.object({
  street: z.string().min(1, 'Area/Locality is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string({ required_error: 'Please select a state.' }),
  zip: z.string().min(6, 'A 6-digit zip code is required.').max(6, 'A 6-digit zip code is required.'),
  landmark: z.string().optional(),
  mapLocationLink: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

const landDetailsSchema = z.object({
    khasraNumber: z.string().optional(),
    landbookNumber: z.string().optional(),
    area: z.coerce.number().min(1, "Land area must be greater than 0."),
    areaUnit: z.string({ required_error: "Please select a unit." }),
});

const propertyFormSchema = z.object({
  address: addressSchema,
  landDetails: landDetailsSchema,
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  purchaseDate: z.date({ required_error: 'A purchase date is required.' }),
  purchasePrice: z.coerce.number().min(1, 'Purchase price must be greater than 0.'),
  isListedPublicly: z.boolean().default(false),
  status: z.enum(['Owned', 'For Sale', 'Sold']).default('Owned'),
  soldPrice: z.coerce.number().optional(),
  soldDate: z.date().optional(),
}).refine(data => {
    if (data.status === 'Sold') {
        return data.soldPrice && data.soldPrice > 0 && data.soldDate;
    }
    return true;
}, {
    message: "Sold Price and Sold Date are required when status is 'Sold'.",
    path: ["status"],
});

type PropertyFormData = z.infer<typeof propertyFormSchema>

export default function PropertyDetailPage() {
  const { user } = useAuth()
  const { propertyId } = useParams()
  const router = useRouter()
  const [property, setProperty] = React.useState<Property | null>(null)
  const [loading, setLoading] = React.useState(true)
  const { toast } = useToast()

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
        status: 'Owned',
        isListedPublicly: false,
    }
  })

  const watchedStatus = form.watch('status')

  React.useEffect(() => {
    if (!user || !db || !propertyId) {
      setLoading(false)
      return
    }

    const fetchProperty = async () => {
      try {
        const propDocRef = doc(db, 'properties', propertyId as string)
        const docSnap = await getDoc(propDocRef)
        if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
          const propData = { id: docSnap.id, ...docSnap.data() } as Property
          setProperty(propData)
          form.reset({
            ...propData,
            purchaseDate: propData.purchaseDate.toDate(),
            soldDate: propData.soldDate?.toDate(),
            isListedPublicly: propData.isListedPublicly || false,
            status: propData.status || 'Owned',
          })
        } else {
          toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
          router.push('/properties')
        }
      } catch (error) {
        console.error('Error fetching property:', error)
        toast({ title: 'Error', description: 'Failed to fetch property data.', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }

    fetchProperty()
  }, [user, db, propertyId, router, toast, form])

  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !db || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }

    const propertyData: Partial<Property> & {ownerUid: string} = {
      ...data,
      ownerUid: user.uid,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      soldDate: data.soldDate ? Timestamp.fromDate(data.soldDate) : null,
      soldPrice: data.soldPrice ?? null,
    };
    
    if (data.status !== 'Sold') {
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
    }

    try {
      const propDocRef = doc(db, 'properties', propertyId as string)
      await updateDoc(propDocRef, {
        ...propertyData
      })
      toast({ title: 'Success', description: 'Property updated successfully.' })
       if (propertyData.status === 'Sold') {
            router.push('/sold-properties')
        }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        </main>
    )
  }

  if (!property) {
    return (
      <main className="flex-1 flex items-center justify-center p-4 lg:p-6">
        <p>Property not found.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
            <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{`${property.address.street}, ${property.address.city}`}</h1>
      </div>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Edit Property Details</CardTitle>
                    <CardDescription>Update the information for this property.</CardDescription>
                </CardHeader>
                <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    
                    {/* Address Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Address Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                            <FormField control={form.control} name="address.state" render={({ field }) => (
                                <FormItem>
                                <FormLabel>State</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a state" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                    {indianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="address.city" render={({ field }) => (
                                <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g. Mumbai" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="address.street" render={({ field }) => (
                                <FormItem className="md:col-span-2"><FormLabel>Area / Locality</FormLabel><FormControl><Input placeholder="e.g. Bandra West" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="address.zip" render={({ field }) => (
                                <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="e.g. 400050" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="address.landmark" render={({ field }) => (
                                <FormItem><FormLabel>Landmark</FormLabel><FormControl><Input placeholder="e.g. Near a specific school" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="address.mapLocationLink" render={({ field }) => (
                                <FormItem className="md:col-span-2"><FormLabel>Map Location Link</FormLabel><FormControl><Input placeholder="https://maps.google.com/..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                    </div>

                    {/* Land Details Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Land Details</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                             <FormField control={form.control} name="landDetails.khasraNumber" render={({ field }) => (
                                <FormItem><FormLabel>Khasra Number</FormLabel><FormControl><Input placeholder="e.g. 123/4" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="landDetails.landbookNumber" render={({ field }) => (
                                <FormItem><FormLabel>Landbook Number</FormLabel><FormControl><Input placeholder="e.g. 5678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="landDetails.area" render={({ field }) => (
                                <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="landDetails.areaUnit" render={({ field }) => (
                                <FormItem><FormLabel>Area Unit</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {landAreaUnits.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}/>
                         </div>
                    </div>

                    {/* Property & Financial Details Section */}
                    <div className="space-y-4">
                         <h3 className="text-lg font-medium">Property & Financial Details</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                            <FormField control={form.control} name="propertyType" render={({ field }) => (
                                <FormItem><FormLabel>Property Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {propertyTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                                <FormItem><FormLabel>Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="5000000" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Purchase Date</FormLabel>
                                <Popover><PopoverTrigger asChild><FormControl>
                                    <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                </PopoverContent></Popover>
                                <FormMessage />
                                </FormItem>
                            )}/>
                         </div>
                    </div>
                    
                    {/* Status Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Property Status</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {propertyStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}/>
                            {watchedStatus === 'Sold' && (
                            <>
                                <FormField control={form.control} name="soldPrice" render={({ field }) => (
                                    <FormItem><FormLabel>Sold Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="soldDate" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Sold Date</FormLabel>
                                    <Popover><PopoverTrigger asChild><FormControl>
                                        <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent></Popover>
                                    <FormMessage />
                                    </FormItem>
                                )}/>
                            </>
                            )}
                             <FormField control={form.control} name="isListedPublicly" render={({ field }) => (
                                <FormItem className="md:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                                <div className="space-y-0.5">
                                    <FormLabel>List Publicly</FormLabel>
                                    <FormDescription>Make this property visible on the public listings page.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )}/>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Save Changes
                        </Button>
                    </div>
                    </form>
                </Form>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="files">
            <div className="mt-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileQuestion className="text-muted-foreground" /> Recommended Documents</CardTitle>
                        <CardDescription>
                           For a complete record, please upload the following documents using the file manager below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li>Registry Document</li>
                            <li>Land Book (Bhu Pustika) Document</li>
                            <li>Owner's Aadhaar Card</li>
                            <li>Owner's PAN Card</li>
                        </ul>
                    </CardContent>
                </Card>
                <FileManager entityType="properties" entityId={property.id} />
            </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}
