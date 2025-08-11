
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, IndianRupee, Loader2, LocateFixed, MapPin, Search } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'

const InteractiveMap = dynamic(() => import('@/components/interactive-map').then(mod => mod.InteractiveMap), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-md" />,
});

const propertyTypes = ['Open Land', 'Flat', 'Villa', 'Commercial Complex Unit', 'Apartment'];
const landAreaUnits = ['Square Feet', 'Acre'];
const landTypes = ['Agricultural', 'Residential', 'Commercial', 'Tribal'];
const propertyStatuses = ['Owned', 'For Sale', 'Sold'];

const baseSchema = z.object({
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
  pricePerUnit: z.coerce.number({invalid_type_error: "Price must be a number"}).positive({ message: "Price per unit must be a positive number." }),
  remarks: z.string().optional(),
  landType: z.string().optional(),
  isDiverted: z.boolean().optional(),
  status: z.string().optional(),
  isListedPublicly: z.boolean().optional(),
  listingPricePerUnit: z.coerce.number().positive().optional(),
  soldPrice: z.coerce.number().positive().optional(),
  soldDate: z.date().optional(),
});

// Refined schema for complex cross-field validation
const propertyFormSchema = baseSchema.refine(data => {
    // If status is 'For Sale' and it's listed publicly, listingPricePerUnit is required
    if (data.status === 'For Sale' && data.isListedPublicly) {
        return data.listingPricePerUnit !== undefined && data.listingPricePerUnit > 0;
    }
    return true;
}, {
    message: "Listing price per unit is required when property is listed publicly.",
    path: ["listingPricePerUnit"],
}).refine(data => {
    // If status is 'Sold', soldPrice is required
    if (data.status === 'Sold') {
        return data.soldPrice !== undefined && data.soldPrice > 0;
    }
    return true;
}, {
    message: "A valid sold price is required.",
    path: ["soldPrice"],
}).refine(data => {
    // If status is 'Sold', soldDate is required
    if (data.status === 'Sold') {
        return data.soldDate !== undefined;
    }
    return true;
}, {
    message: "A sold date is required.",
    path: ["soldDate"],
});


type FormValues = z.infer<typeof propertyFormSchema>;

export type PropertyFormData = FormValues & {
    purchasePrice: number;
    listingPrice?: number;
};

interface PropertyFormProps {
    onSubmit: (data: PropertyFormData) => void;
    initialData?: Partial<PropertyFormData>;
    isSaving: boolean;
    submitButtonText: string;
    mode: 'add' | 'edit';
    children?: React.ReactNode;
}

export function PropertyForm({ initialData, isSaving, submitButtonText, mode, children, onSubmit: parentOnSubmit }: PropertyFormProps) {
  const { toast } = useToast()
  
  const [mapCenter, setMapCenter] = React.useState<[number, number]>([20.5937, 78.9629]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [isFindingOnMap, setIsFindingOnMap] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: mode === 'add' ? {
        name: '',
        address: { street: '', city: '', state: '', zip: '', landmark: '' },
        landDetails: { khasraNumber: '', landbookNumber: '' },
        remarks: '',
        isDiverted: false,
        isListedPublicly: false,
        status: 'Owned',
    } : initialData,
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

  const watchedValues = form.watch();

  const calculatedPurchaseValue = React.useMemo(() => {
    const area = Number(watchedValues.landDetails?.area) || 0;
    const price = Number(watchedValues.pricePerUnit) || 0;
    return area * price;
  }, [watchedValues.landDetails?.area, watchedValues.pricePerUnit]);

  const calculatedListingValue = React.useMemo(() => {
    const area = Number(watchedValues.landDetails?.area) || 0;
    const price = Number(watchedValues.listingPricePerUnit) || 0;
    return area * price;
  }, [watchedValues.landDetails?.area, watchedValues.listingPricePerUnit]);


  const handleFormSubmit = (data: FormValues) => {
    const finalData: PropertyFormData = {
        ...data,
        purchasePrice: calculatedPurchaseValue,
        listingPrice: calculatedListingValue > 0 ? calculatedListingValue : undefined,
    };
    parentOnSubmit(finalData);
}

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
    }, 500);

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
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Property Name</h3>
            <div className="border p-4 rounded-md space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="e.g. My Mumbai Flat" {...field} value={field.value ?? ''} /></FormControl>
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
                            ref={searchInputRef}
                            placeholder="Start typing an address or pincode..." 
                            className="pl-10 pr-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => {
                                if (searchQuery.length > 2) {
                                     // This logic is handled by the useEffect for searchQuery
                                }
                            }}
                            autoComplete="off"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleGetCurrentLocation} title="Use my current location">
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

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Legal Details</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                 <FormField control={form.control} name="landDetails.khasraNumber" render={({ field }) => (
                    <FormItem><FormLabel>Khasra / Registry Number</FormLabel><FormControl><Input placeholder="e.g. 123/4" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="landDetails.landbookNumber" render={({ field }) => (
                    <FormItem><FormLabel>Landbook Number (Bhu Pustika)</FormLabel><FormControl><Input placeholder="e.g. 5678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>
             </div>
        </div>
        
        <div className="space-y-4">
             <h3 className="text-lg font-medium">Property & Financial Details</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 border p-4 rounded-md">
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
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                    <FormItem className="flex flex-col pt-1.5">
                        <FormLabel>Purchase Date</FormLabel>
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

                {watchedValues.propertyType === 'Open Land' && (
                  <>
                    <FormField control={form.control} name="landType" render={({ field }) => (
                        <FormItem><FormLabel>Land Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={initialData?.landType}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a land type" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {landTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="isDiverted" render={({ field }) => (
                        <FormItem className="flex flex-col pt-1.5">
                            <FormLabel>Diverted Land</FormLabel>
                             <div className="flex items-center space-x-2 pt-2.5">
                                <FormControl><Switch id="isDivertedSwitch" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <label htmlFor="isDivertedSwitch" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Is the land diverted?
                                </label>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}/>
                  </>
                )}
                
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
                <FormField control={form.control} name="landDetails.area" render={({ field }) => (
                    <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>

                <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Price per {watchedValues.landDetails?.areaUnit || 'Unit'} (₹)</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g. 5000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                
                <div className="md:col-span-2 space-y-1">
                    <FormLabel>Purchase Price</FormLabel>
                    <div className="text-2xl font-bold p-2 bg-muted/50 rounded-md min-h-[44px] flex items-center">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(calculatedPurchaseValue)}
                    </div>
                    <FormDescription>This value is calculated from Land Area and Price per Unit and will be saved.</FormDescription>
                </div>
             </div>
        </div>

        {mode === 'edit' && (
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Property Status & Listing</h3>
                 <div className="border p-4 rounded-md space-y-6">
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

                    {watchedValues.status === 'For Sale' && (
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
                            {watchedValues.isListedPublicly && (
                                <div className="space-y-4">
                                     <FormField control={form.control} name="listingPricePerUnit" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Listing Price per {watchedValues.landDetails?.areaUnit || 'Unit'} (₹)</FormLabel>
                                            <FormControl><Input type="number" placeholder="e.g. 6000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <div className="space-y-1">
                                        <FormLabel>Calculated Listing Price</FormLabel>
                                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                            <IndianRupee className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-2xl font-bold">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(calculatedListingValue)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {watchedValues.status === 'Sold' && (
                        <div className="space-y-4 rounded-md border p-4">
                            <FormField control={form.control} name="soldPrice" render={({ field }) => (
                                <FormItem><FormLabel>Final Sale Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
            </div>
        )}
        
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Remarks</h3>
            <div className="border p-4 rounded-md">
                <FormField control={form.control} name="remarks" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                            <Textarea
                                placeholder="Add any other relevant details about the property..."
                                className="resize-y"
                                {...field}
                                value={field.value ?? ''}
                            />
                        </FormControl>
                        <FormDescription>
                            This field is for any extra information you want to keep with this property record.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
        </div>

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
