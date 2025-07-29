
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

const InteractiveMap = dynamic(() => import('@/components/interactive-map').then(mod => mod.InteractiveMap), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-md" />,
});

const addressSchema = z.object({
  street: z.string().min(1, 'Area/Locality is required'),
  city: z.string().min(1, 'City is required.'),
  state: z.string().min(1, 'State is required.'),
  zip: z.string().min(6, 'A 6-digit zip code is required.').max(6, 'A 6-digit zip code is required.'),
  landmark: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const prospectSchema = z.object({
  name: z.string().min(3, 'A name for the prospect is required.'),
  address: addressSchema,
});

export type ProspectFormData = z.infer<typeof prospectSchema>

interface ProspectFormProps {
    onSubmit: (data: ProspectFormData) => void;
    isSaving: boolean;
    submitButtonText: string;
    children?: React.ReactNode;
}

export function ProspectForm({ onSubmit, isSaving, submitButtonText, children }: ProspectFormProps) {
  const { toast } = useToast()
  
  const [mapCenter, setMapCenter] = React.useState<[number, number]>([20.5937, 78.9629]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [isFindingOnMap, setIsFindingOnMap] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<ProspectFormData>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
        name: '',
        address: {
            street: '',
            city: '',
            state: '',
            zip: '',
        },
    }
  });

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
            <h3 className="text-lg font-medium">Prospect Name</h3>
            <div className="border p-4 rounded-md space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="e.g. South Mumbai Sea View Flat" {...field} value={field.value ?? ''} /></FormControl>
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
                    <FormDescription>Find the address to automatically fill the fields below.</FormDescription>
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
