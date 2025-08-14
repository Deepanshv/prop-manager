
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { ArrowLeft, Calendar as CalendarIcon, Loader2, LocateFixed, MapPin, Search } from 'lucide-react'
import dynamic from 'next/dynamic'
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

const InteractiveMap = dynamic(() => import('@/components/interactive-map').then(mod => mod.InteractiveMap), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-md" />,
});

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


type PropertyFormData = z.infer<typeof propertyFormSchema>

function PropertyForm({
    initialData,
    onSubmit,
    isSaving,
}: {
    initialData: PropertyFormData,
    onSubmit: (data: PropertyFormData) => void,
    isSaving: boolean
}) {
  const router = useRouter();
  const { toast } = useToast()
  
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: initialData,
  });

  const [mapCenter, setMapCenter] = React.useState<[number, number]>(
    initialData?.address?.latitude && initialData?.address?.longitude 
    ? [initialData.address.latitude, initialData.address.longitude] 
    : [20.5937, 78.9629]
  );
  
  const [searchQuery, setSearchQuery] = React.useState(
      initialData?.address ? [initialData.address.street, initialData.address.city, initialData.address.state].filter(Boolean).join(', ') : ''
  );
  const [isSearching, setIsSearching] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isFindingOnMap, setIsFindingOnMap] = React.useState(false);
  
  React.useEffect(() => {
    const handler = setTimeout(async () => {
        if (searchQuery.length > 2 && document.activeElement === searchInputRef.current) {
            setIsSearching(true);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&countrycodes=in&limit=5`);
                const data = await response.json();
                setSuggestions(data);
            } catch (error) {
                toast({ title: "Search Error", description: "Could not connect to the address search service.", variant: "destructive" });
            } finally {
                setIsSearching(false);
            }
        } else {
            setSuggestions([]);
        }
    }, 500); // Debounce search

    return () => clearTimeout(handler);
  }, [searchQuery, toast]);

  const handleSuggestionSelect = (suggestion: any) => {
    const { address, lat, lon } = suggestion;
    const newCenter: [number, number] = [parseFloat(lat), parseFloat(lon)];

    form.setValue('address.street', address.road || address.suburb || address.neighbourhood || '');
    form.setValue('address.city', address.city || address.town || address.village || '');
    form.setValue('address.state', address.state || '');
    form.setValue('address.zip', address.postcode || '');
    form.setValue('address.latitude', newCenter[0], { shouldValidate: true });
    form.setValue('address.longitude', newCenter[1], { shouldValidate: true });

    setMapCenter(newCenter);
    setSearchQuery(suggestion.display_name);
    setSuggestions([]);
    searchInputRef.current?.blur();
  };
  
  const handleFindOnMap = async () => {
    const address = form.getValues('address');
    const manualQuery = [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');

    if (!manualQuery) {
        toast({ title: "Address needed", description: "Please enter an address or pincode to find on the map.", variant: "destructive" });
        return;
    }
    
    setIsFindingOnMap(true);
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualQuery)}&format=json&addressdetails=1&countrycodes=in&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            handleSuggestionSelect(data[0]);
            toast({ title: "Location Found", description: "The map has been updated to the new location." });
        } else {
            toast({ title: "Not Found", description: "Could not find a location for the provided address.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Search Error", description: "Could not connect to the address search service.", variant: "destructive" });
    } finally {
        setIsFindingOnMap(false);
    }
  };

  const handleMarkerMove = React.useCallback(async (lat: number, lng: number) => {
    form.setValue('address.latitude', lat, { shouldValidate: true });
    form.setValue('address.longitude', lng, { shouldValidate: true });
    setMapCenter([lat, lng]);

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
        const data = await response.json();
        if (data && data.address) {
            const { address } = data;
            form.setValue('address.street', address.road || address.suburb || address.neighbourhood || '', { shouldValidate: true });
            form.setValue('address.city', address.city || address.town || address.village || '', { shouldValidate: true });
            form.setValue('address.state', address.state || '', { shouldValidate: true });
            form.setValue('address.zip', address.postcode || '', { shouldValidate: true });
            setSearchQuery(data.display_name);
            toast({ title: "Address Updated", description: "Address fields have been updated based on pin location." });
        } else {
             toast({ title: "Location Error", description: "Could not find address details for this location.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Connection Error", description: "Could not connect to the address service.", variant: "destructive" });
    }
  }, [form, toast]);


  const watchedStatus = form.watch('status');
  const watchedIsListedPublicly = form.watch('isListedPublicly');
  const watchedPropertyType = form.watch('propertyType');
  
  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
           <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                  <FormLabel>Property Name</FormLabel>
                  <FormControl><Input placeholder="e.g. My Mumbai Flat" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
              </FormItem>
          )}/>

          <div className="space-y-4">
              <h3 className="text-lg font-medium">Address & Location</h3>
              <div className="border p-4 rounded-md space-y-4">
                  <div className="space-y-2 relative">
                      <FormLabel>Smart Address Search</FormLabel>
                      <FormDescription>Find the address to automatically fill the fields below.</FormDescription>
                      <div className="relative mt-2">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                              ref={searchInputRef}
                              placeholder="Start typing an address or pincode..." 
                              className="pl-10 pr-10"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              autoComplete="off"
                          />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => {}} title="Use my current location">
                              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                          </Button>
                      </div>
                      {suggestions.length > 0 && (
                          <div className="absolute z-50 w-full bg-background border rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
                              {suggestions.map((s) => (
                                  <div 
                                      key={s.place_id} 
                                      onClick={() => handleSuggestionSelect(s)}
                                      className="p-2 hover:bg-muted cursor-pointer text-sm"
                                  >
                                      {s.display_name}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="address.street" render={({ field }) => (
                              <FormItem><FormLabel>Area / Locality</FormLabel><FormControl><Input placeholder="e.g. Juhu" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="address.city" render={({ field }) => (
                              <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g. Mumbai" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="address.state" render={({ field }) => (
                              <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="e.g. Maharashtra" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="address.zip" render={({ field }) => (
                              <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="e.g. 400049" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )}/>
                      </div>
                      <Button type="button" variant="outline" onClick={handleFindOnMap} disabled={isFindingOnMap} className="w-full md:w-auto">
                          {isFindingOnMap ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                          Find on Map with Manual Address
                      </Button>
                  </div>
              </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Set Location on Map</h3>
            <div className="border p-4 rounded-md space-y-2">
                <p className="text-sm text-muted-foreground">
                    Drag the pin or click on the map to set the exact property location.
                </p>
                <InteractiveMap center={mapCenter} onMarkerMove={handleMarkerMove} />
            </div>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
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
                <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
            )}/>

            <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                <FormItem><FormLabel>Total Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
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
                           <FormItem><FormLabel>Listing Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 6000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)}  value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
                       )}/>
                   )}
               </div>
           )}

           {watchedStatus === 'Sold' && (
               <div className="space-y-4 rounded-md border p-4">
                   <FormField control={form.control} name="soldPrice" render={({ field }) => (
                       <FormItem><FormLabel>Final Sale Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)}  value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
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
              <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Add any other relevant details..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
               {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Save Changes
            </Button>
          </div>
        </form>
      </Form>
  )
}


export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const propertyId = params.propertyId as string

  const [isSaving, setIsSaving] = React.useState(false)
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [formKey, setFormKey] = React.useState(Date.now());

  const fetchAndSetProperty = React.useCallback(async () => {
    if (!user || !db) return;
    try {
        const propDocRef = doc(db, 'properties', propertyId);
        const docSnap = await getDoc(propDocRef);
        if (docSnap.exists() && docSnap.data().ownerUid === user.uid) {
            setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        } else {
            toast({ title: 'Error', description: 'Property not found or you do not have access.', variant: 'destructive' })
            router.push('/properties');
        }
    } catch (error) {
        console.error("Failed to fetch property on client:", error);
        toast({ title: 'Error', description: 'Failed to load property details.', variant: 'destructive' })
        router.push('/properties');
    }
  }, [propertyId, user, router, toast]);

  React.useEffect(() => {
    if (user) {
        setLoading(true);
        fetchAndSetProperty().finally(() => setLoading(false));
    }
  }, [user, fetchAndSetProperty]);

  const formInitialData = React.useMemo(() => {
    if (!property) return null;

    return {
      ...property,
      purchaseDate: property.purchaseDate.toDate(),
      soldDate: property.soldDate?.toDate(),
    };
  }, [property]);


  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !propertyId) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    const propertyData: Record<string, any> = {
        ...data,
        ownerUid: user.uid,
        purchaseDate: Timestamp.fromDate(data.purchaseDate),
        landType: data.landType || null,
        remarks: data.remarks || null,
    };

    if (data.status === 'Sold') {
        propertyData.soldDate = data.soldDate ? Timestamp.fromDate(data.soldDate) : null;
        propertyData.isListedPublicly = false;
        propertyData.listingPrice = data.listingPrice || null;
    } else if (data.status === 'For Sale') {
        propertyData.soldDate = null;
        propertyData.soldPrice = null;
        if (data.isListedPublicly) {
            propertyData.listingPrice = data.listingPrice || null;
        } else {
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
          await fetchAndSetProperty();
          setFormKey(Date.now());
      }
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' })
    } finally {
        setIsSaving(false)
    }
  };

  if (loading || !property || !formInitialData) {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-8 w-48" />
            </div>
            <div className="grid gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
            </div>
        </div>
    )
  }

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
                    <PropertyForm 
                        key={formKey}
                        onSubmit={onSubmit}
                        initialData={formInitialData}
                        isSaving={isSaving}
                    />
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
