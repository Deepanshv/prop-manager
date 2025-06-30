
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Loader2, LocateFixed, MapPin, Search } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const InteractiveMap = dynamic(() => import('@/components/interactive-map').then(mod => mod.InteractiveMap), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-md" />,
});

const propertyTypes = ['Agricultural', 'Commercial', 'Residential', 'Tribal'];
const landAreaUnits = ['Square Feet', 'Acre'];
const propertyStatuses = ['Owned', 'For Sale', 'Sold'];

const addressSchema = z.object({
  street: z.string().min(1, 'Area/Locality is required'),
  city: z.string().min(1, 'City is required.'),
  state: z.string().min(1, 'State is required.'),
  zip: z.string().min(6, 'A 6-digit zip code is required.').max(6, 'A 6-digit zip code is required.'),
  landmark: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const landDetailsSchema = z.object({
    khasraNumber: z.string().optional(),
    landbookNumber: z.string().optional(),
    area: z.coerce.number().min(1, "Land area must be greater than 0."),
    areaUnit: z.string({ required_error: "Please select a unit." }),
});

const basePropertyFormSchema = z.object({
  name: z.string().min(3, 'Property name must be at least 3 characters.'),
  address: addressSchema,
  landDetails: landDetailsSchema,
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  purchaseDate: z.date({ required_error: 'A purchase date is required.' }),
  purchasePrice: z.coerce.number().min(1, 'Purchase price must be greater than 0.'),
  isListedPublicly: z.boolean().default(false),
});

export const editPropertyFormSchema = basePropertyFormSchema.extend({
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

export type PropertyFormData = z.infer<typeof editPropertyFormSchema>

interface PropertyFormProps {
    onSubmit: (data: PropertyFormData) => void;
    initialData?: Partial<PropertyFormData>;
    isSaving: boolean;
    submitButtonText: string;
    mode: 'add' | 'edit';
    children?: React.ReactNode;
}

export function PropertyForm({ onSubmit, initialData, isSaving, submitButtonText, mode, children }: PropertyFormProps) {
  const { toast } = useToast()
  
  const [mapCenter, setMapCenter] = React.useState<[number, number]>([20.5937, 78.9629]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [isFindingOnMap, setIsFindingOnMap] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(mode === 'edit' ? editPropertyFormSchema : basePropertyFormSchema),
    // In edit mode, we'll use form.reset() in useEffect to populate the form
    // In add mode, we can set some defaults.
    defaultValues: mode === 'add' ? {
        status: 'Owned',
        isListedPublicly: false,
        name: '',
        address: {
            street: '',
            city: '',
            state: '',
            zip: '',
            landmark: '',
        },
        landDetails: {
            khasraNumber: '',
            landbookNumber: '',
        }
    } : undefined
  })
  
  React.useEffect(() => {
    if (initialData) {
      form.reset(initialData);
      if (initialData.address) {
        if (initialData.address.latitude && initialData.address.longitude) {
            setMapCenter([initialData.address.latitude, initialData.address.longitude]);
        }
        setSearchQuery([initialData.address.street, initialData.address.city].filter(Boolean).join(', '));
      }
    }
  }, [initialData, form]);

  const watchedStatus = form.watch('status');

  React.useEffect(() => {
    const handler = setTimeout(async () => {
        if (searchQuery.length > 2) {
            setIsSearching(true);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&countrycodes=in`);
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
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
        setIsSearching(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                const data = await response.json();
                if (data) {
                    handleSuggestionSelect(data);
                }
            } catch (error) {
                toast({ title: "Location Error", description: "Could not find address for your location.", variant: "destructive" });
            } finally {
                setIsSearching(false);
            }
        }, () => {
            toast({ title: "Location Error", description: "Could not get your location. Please enable location services.", variant: "destructive" });
            setIsSearching(false);
        });
    }
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Property Name</h3>
            <div className="border p-4 rounded-md space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="e.g. My Mumbai Flat" {...field} value={field.value ?? ''} /></FormControl>
                        <FormDescription>A unique name for easy identification.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Address Details</h3>
            <div className="border p-4 rounded-md space-y-4">
                <div className="space-y-2 relative">
                    <FormLabel>Smart Address Search</FormLabel>
                    <FormDescription>Start here for the fastest results. You can manually correct the fields below if needed.</FormDescription>
                    <div className="relative mt-2">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Start typing an address or pincode..." 
                            className="pl-10 pr-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoComplete="off"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleGetCurrentLocation} title="Use my current location">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                        </Button>
                    </div>
                    {suggestions.length > 0 && (
                        <div className="absolute z-20 w-full bg-background border rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
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
                    <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="landDetails.areaUnit" render={({ field }) => (
                    <FormItem><FormLabel>Area Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={initialData?.landDetails?.areaUnit}>
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

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Property & Financial Details</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                    <FormItem><FormLabel>Property Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={initialData?.propertyType}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {propertyTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                    <FormItem><FormLabel>Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="5000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
        
        {mode === 'edit' && (
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
                            <FormItem><FormLabel>Sold Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
        )}
        
        {mode === 'add' && (
           <FormField control={form.control} name="isListedPublicly" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <FormLabel>List Publicly</FormLabel>
                    <FormDescription>Make this property visible on the public listings page.</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )}/>
        )}


        <div className="flex justify-end gap-2">
            {children}
            <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {submitButtonText}
            </Button>
        </div>
      </form>
    </Form>
  )
}
