
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { ArrowLeft, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { FileManager } from '@/components/file-manager'
import { MediaManager } from '@/components/media-manager'
import { useAuth } from '../../layout'
import type { Property } from '../page'

const propertyTypes = ['Open Land', 'Flat', 'Villa', 'Commercial Complex Unit', 'Apartment'];
const landAreaUnits = ['Square Feet', 'Acre'];
const landTypes = ['Agricultural', 'Residential', 'Commercial', 'Tribal'];
const propertyStatuses = ['Owned', 'For Sale', 'Sold'];

const propertyFormSchema = z.object({
  name: z.string().min(3, 'Property name must be at least 3 characters.'),
  address: z.object({
    street: z.string().min(1, 'Area/Locality is required'),
    city: z.string().min(1, 'City is required.'),
    state: z.string().min(1, 'State is required.'),
    zip: z.string().min(6, 'A 6-digit zip code is required.').max(6, 'A 6-digit zip code is required.'),
    landmark: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  }),
  landDetails: z.object({
      khasraNumber: z.string().optional(),
      landbookNumber: z.string().optional(),
      area: z.coerce.number({invalid_type_error: "Area must be a number"}).min(0.0001, "Land area must be greater than 0."),
      areaUnit: z.string({ required_error: "Please select a unit." }),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  purchaseDate: z.date({ required_error: 'A purchase date is required.' }),
  purchasePrice: z.coerce.number().positive("Purchase price must be positive."),
  remarks: z.string().optional(),
  landType: z.string().optional(),
  isDiverted: z.boolean().optional(),
  status: z.string({required_error: "Status is required."}),
  isListedPublicly: z.boolean().optional(),
  listingPrice: z.coerce.number().positive().optional(),
  soldPrice: z.coerce.number().positive().optional(),
  soldDate: z.date().optional(),
})
.refine(data => {
    if (data.status === 'For Sale' && data.isListedPublicly) {
        return data.listingPrice !== undefined && data.listingPrice > 0;
    }
    return true;
}, {
    message: "A listing price is required when the property is public.",
    path: ["listingPrice"],
})
.refine(data => {
    if (data.status === 'Sold') {
        return data.soldPrice !== undefined && data.soldPrice > 0;
    }
    return true;
}, {
    message: "A valid sold price is required when status is 'Sold'.",
    path: ["soldPrice"],
})
.refine(data => {
    if (data.status === 'Sold') {
        return !!data.soldDate;
    }
    return true;
}, {
    message: "A sold date is required when status is 'Sold'.",
    path: ["soldDate"],
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;


export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const propertyId = params.propertyId as string

  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
  });

  const fetchAndSetProperty = React.useCallback(async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
        const propDocRef = doc(db, 'properties', propertyId);
        const docSnap = await getDoc(propDocRef);
        if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
            const data = { id: docSnap.id, ...docSnap.data() } as Property
            setProperty(data);

            // This is the fix: ensure all form values are defined and not null/undefined.
            form.reset({
              ...data,
              name: data.name || '',
              address: {
                street: data.address?.street || '',
                city: data.address?.city || '',
                state: data.address?.state || '',
                zip: data.address?.zip || '',
                landmark: data.address?.landmark || '',
                latitude: data.address?.latitude || undefined,
                longitude: data.address?.longitude || undefined,
              },
              landDetails: {
                  ...data.landDetails,
                  khasraNumber: data.landDetails?.khasraNumber || '',
                  landbookNumber: data.landDetails?.landbookNumber || '',
              },
              purchaseDate: data.purchaseDate.toDate(),
              soldDate: data.soldDate?.toDate(),
              remarks: data.remarks || '',
              landType: data.landType || '',
              isDiverted: data.isDiverted || false,
              status: data.status || 'Owned',
              isListedPublicly: data.isListedPublicly || false,
              listingPrice: data.listingPrice || undefined,
              soldPrice: data.soldPrice || undefined,
            });
        } else {
            toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
            router.push('/properties');
        }
    } catch (error) {
        console.error("Failed to fetch property on client:", error);
        toast({ title: 'Error', description: 'Failed to load property details.', variant: 'destructive' })
        router.push('/properties');
    } finally {
        setLoading(false);
    }
  }, [propertyId, user, router, toast, form]);

  React.useEffect(() => {
    if (user) {
        fetchAndSetProperty();
    }
  }, [user, fetchAndSetProperty]);


  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }

    const propertyData: Record<string, any> = {
        ...data,
        ownerUid: user.uid,
        purchaseDate: Timestamp.fromDate(data.purchaseDate),
        landType: data.landType ?? null,
        remarks: data.remarks ?? null,
    };

    if (data.status === 'Sold') {
        propertyData.soldDate = data.soldDate ? Timestamp.fromDate(data.soldDate) : null;
        propertyData.isListedPublicly = false; 
        propertyData.listingPrice = null;
    } else if (data.status === 'For Sale') {
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
        if (!data.isListedPublicly) {
            propertyData.listingPrice = null;
        }
    } else { // 'Owned' status
        propertyData.isListedPublicly = false;
        propertyData.listingPrice = null;
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
    }

    try {
      const propDocRef = doc(db, 'properties', propertyId)
      await updateDoc(propDocRef, propertyData)
      toast({ title: 'Success', description: 'Property updated successfully.' })
        
      if (propertyData.status === 'Sold') {
          router.push('/sold-properties')
      } else {
          fetchAndSetProperty(); // Refresh data on the page
      }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    }
  };

  if (loading || !property) {
    return (
        <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        </div>
    )
  }
  
  const watchedStatus = form.watch('status');
  const watchedIsListedPublicly = form.watch('isListedPublicly');
  const watchedPropertyType = form.watch('propertyType');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
      </div>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="files">Media & Files</TabsTrigger>
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
                       <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Property Name</FormLabel>
                              <FormControl><Input placeholder="e.g. My Mumbai Flat" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="address.street" render={({ field }) => (
                            <FormItem><FormLabel>Area / Locality</FormLabel><FormControl><Input placeholder="e.g. Juhu" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="address.city" render={({ field }) => (
                            <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g. Mumbai" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="address.state" render={({ field }) => (
                            <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="e.g. Maharashtra" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="address.zip" render={({ field }) => (
                            <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="e.g. 400049" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
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
                        <FormField control={form.control} name="purchaseDate" render={({ field }) => (
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

                        {watchedPropertyType === 'Open Land' && (
                          <>
                            <FormField control={form.control} name="landType" render={({ field }) => (
                                <FormItem><FormLabel>Land Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a land type" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {landTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="isDiverted" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2"><div className="space-y-0.5">
                                    <FormLabel>Diverted Land</FormLabel>
                                    <FormDescription>Is the land diverted?</FormDescription>
                                </div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                            )}/>
                          </>
                        )}
                        
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
                        <FormField control={form.control} name="landDetails.area" render={({ field }) => (
                            <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
                        )}/>

                        <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                            <FormItem><FormLabel>Total Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
                        )}/>
                      </div>

                      <div className="space-y-4">
                        <FormField control={form.control} name="status" render={({ field }) => (
                           <FormItem><FormLabel>Property Status</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value}>
                               <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                               <SelectContent>
                                   {propertyStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                               </SelectContent>
                           </Select>
                           <FormMessage />
                           </FormItem>
                       )}/>

                       {watchedStatus === 'For Sale' && (
                           <div className="space-y-4 rounded-md border p-4">
                               <FormField control={form.control} name="isListedPublicly" render={({ field }) => (
                                   <FormItem className="flex flex-row items-center justify-between">
                                       <div className="space-y-0.5">
                                           <FormLabel>List Publicly</FormLabel>
                                           <FormDescription>Make this property visible on the public listings page.</FormDescription>
                                       </div>
                                       <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                   </FormItem>
                               )}/>
                               {watchedIsListedPublicly && (
                                   <FormField control={form.control} name="listingPrice" render={({ field }) => (
                                       <FormItem><FormLabel>Listing Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 6000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
                                   )}/>
                               )}
                           </div>
                       )}

                       {watchedStatus === 'Sold' && (
                           <div className="space-y-4 rounded-md border p-4">
                               <FormField control={form.control} name="soldPrice" render={({ field }) => (
                                   <FormItem><FormLabel>Final Sale Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
                               )}/>
                               <FormField control={form.control} name="soldDate" render={({ field }) => (
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
                           </div>
                       )}
                      </div>

                      <FormField control={form.control} name="remarks" render={({ field }) => (
                          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Add any other relevant details..." {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
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
                <MediaManager entityType="properties" entityId={property.id} />
                <FileManager entityType="properties" entityId={property.id} />
            </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
