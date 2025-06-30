
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { collection, deleteDoc, doc, onSnapshot, query, Timestamp, updateDoc, where, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage'
import type { User } from 'firebase/auth'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, CheckCircle, Loader2, MoreHorizontal, Plus, Trash, View, Building, MapPin, LocateFixed } from 'lucide-react'
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { db, storage } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useAuth } from '../layout'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const InteractiveMap = dynamic(() => import('@/components/interactive-map').then(mod => mod.InteractiveMap), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-md" />,
});

const propertyTypes = ['Agricultural', 'Commercial', 'Residential', 'Tribal'];
const landAreaUnits = ['Square Feet', 'Acre'];

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

const propertyFormSchema = z.object({
  address: addressSchema,
  landDetails: landDetailsSchema,
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  purchaseDate: z.date({ required_error: 'A purchase date is required.' }),
  purchasePrice: z.coerce.number().min(1, 'Purchase price must be greater than 0.'),
  isListedPublicly: z.boolean().default(false),
  registryDoc: z.instanceof(File).optional(),
  landBookDoc: z.instanceof(File).optional(),
  aadhaarDoc: z.instanceof(File).optional(),
  panDoc: z.instanceof(File).optional(),
});
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
  isListedPublicly?: boolean
  status?: 'Owned' | 'For Sale' | 'Sold'
  soldPrice?: number
  soldDate?: Timestamp
}

const PropertyCard = ({ property, onDelete, onMarkAsSold }: { property: Property, onDelete: (p: Property) => void, onMarkAsSold: (p: Property) => void }) => {
    const router = useRouter();

    return (
        <Card className="flex flex-col">
            <Link href={`/properties/${property.id}`} className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
                <CardHeader>
                    <CardTitle className="text-lg">{property.address.street}</CardTitle>
                    <CardDescription className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {property.address.city}, {property.address.state}</CardDescription>
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
                    <Badge variant={property.status === 'For Sale' ? 'outline' : 'secondary'}>{property.status || 'Owned'}</Badge>
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
}

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

  const [mapCenter, setMapCenter] = React.useState<[number, number]>([20.5937, 78.9629]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);


  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      isListedPublicly: false,
      address: { street: '', city: '', state: '', zip: '', landmark: ''},
      landDetails: { khasraNumber: '', landbookNumber: '', area: undefined, areaUnit: undefined },
      propertyType: undefined,
    },
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

  const handleAddProperty = () => {
    form.reset({
      isListedPublicly: false,
      address: { street: '', city: '', state: '', zip: '', landmark: '' },
      landDetails: { khasraNumber: '', landbookNumber: '', area: undefined, areaUnit: undefined },
      propertyType: undefined,
    })
    setMapCenter([20.5937, 78.9629])
    setSearchQuery('')
    setSuggestions([])
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

  const handleMarkerMove = (lat: number, lng: number) => {
    form.setValue('address.latitude', lat, { shouldValidate: true });
    form.setValue('address.longitude', lng, { shouldValidate: true });
    setMapCenter([lat, lng]);
  }

  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !db || !storage) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true);
    
    const newPropertyRef = doc(collection(db, 'properties'));
    const newPropertyId = newPropertyRef.id;

    const uploadFile = (file: File, user: User) => {
        return new Promise((resolve, reject) => {
            const filePath = `users/${user.uid}/properties/${newPropertyId}/documents/${file.name}`;
            const fileRef = storageRef(storage, filePath);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on(
                'state_changed',
                null, 
                (error) => { reject(error); },
                async () => {
                    const fileDocRef = doc(db, 'properties', newPropertyId, 'files', file.name);
                    try {
                        await setDoc(fileDocRef, {
                          fileName: file.name,
                          storagePath: filePath,
                          contentType: file.type,
                          sizeBytes: file.size,
                          uploadTimestamp: serverTimestamp(),
                        });
                        resolve(true);
                    } catch (firestoreError) {
                        reject(firestoreError);
                    }
                }
            );
        });
    };

    try {
        const filesToUpload: File[] = [
            data.registryDoc,
            data.landBookDoc,
            data.aadhaarDoc,
            data.panDoc
        ].filter((file): file is File => file instanceof File && file.size > 0);
        
        if (filesToUpload.length > 0) {
            await Promise.all(filesToUpload.map(file => uploadFile(file, user)));
        }

        const { registryDoc, landBookDoc, aadhaarDoc, panDoc, ...propertyDetails } = data;

        const propertyData = {
          ...propertyDetails,
          purchaseDate: Timestamp.fromDate(data.purchaseDate),
          ownerUid: user.uid,
          status: 'Owned',
        };
        
        await setDoc(newPropertyRef, propertyData);
        
        toast({ title: 'Success', description: 'Property and documents added successfully.' });
        setIsModalOpen(false);

    } catch (error) {
        console.error('Error during property creation: ', error);
        toast({ title: 'Error', description: 'Failed to save property or upload a document. Please try again.', variant: 'destructive' });
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
        <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
        <CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent>
        <CardFooter><Skeleton className="h-10 w-full" /></CardFooter></Card>
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
            <DialogDescription>Fill in the details to add a new property. Documents and precise location can be added later.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4 max-h-[80vh] overflow-y-auto pr-4">
              
              <div className="space-y-2">
                <h3 className="font-medium">Address Details</h3>
                <div className="border p-4 rounded-md space-y-4">
                  <div className="space-y-2 relative">
                      <FormLabel>Smart Address Search</FormLabel>
                      <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                              placeholder="Start typing an address..." 
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="address.street" render={({ field }) => (
                          <FormItem><FormLabel>Area / Locality</FormLabel><FormControl><Input placeholder="Auto-populated" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={form.control} name="address.city" render={({ field }) => (
                          <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Auto-populated" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={form.control} name="address.state" render={({ field }) => (
                          <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="Auto-populated" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={form.control} name="address.zip" render={({ field }) => (
                          <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="Auto-populated" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                      )}/>
                  </div>
                </div>
              </div>


              <div className="space-y-2">
                <h3 className="font-medium">Set Location on Map (Optional)</h3>
                <div className="border p-4 rounded-md space-y-2">
                    <p className="text-sm text-muted-foreground">
                        Drag the pin to set the exact property location.
                    </p>
                    <InteractiveMap center={mapCenter} onMarkerMove={handleMarkerMove} />
                </div>
              </div>
              
              <div className="space-y-2">
                 <h3 className="font-medium">Land Details</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                    <FormField control={form.control} name="landDetails.khasraNumber" render={({ field }) => (
                        <FormItem><FormLabel>Khasra Number (Optional)</FormLabel><FormControl><Input placeholder="e.g. 123/4" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="landDetails.landbookNumber" render={({ field }) => (
                        <FormItem><FormLabel>Landbook Number (Optional)</FormLabel><FormControl><Input placeholder="e.g. 5678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="landDetails.area" render={({ field }) => (
                        <FormItem><FormLabel>Land Area</FormLabel><FormControl><Input type="number" placeholder="e.g. 1200" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="landDetails.areaUnit" render={({ field }) => (
                        <FormItem><FormLabel>Area Unit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                            <SelectContent>{landAreaUnits.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                 </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Property &amp; Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                    <FormField control={form.control} name="propertyType" render={({ field }) => (
                        <FormItem><FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                            <SelectContent>{propertyTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                        <FormItem><FormLabel>Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="5000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                        <FormItem className="flex flex-col md:col-span-2"><FormLabel>Purchase Date</FormLabel>
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
                    <FormField control={form.control} name="isListedPublicly" render={({ field }) => (
                        <FormItem className="md:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>List Publicly</FormLabel>
                            <FormDescription>Make this property visible on the public listings page.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}/>
                </div>
              </div>

               <div className="space-y-2">
                <h3 className="font-medium">Documents (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                   <FormField control={form.control} name="registryDoc" render={({ field: { onBlur, name, ref } }) => (
                        <FormItem>
                            <FormLabel>Registry Document</FormLabel>
                            <FormControl><Input type="file" onBlur={onBlur} name={name} ref={ref} onChange={(e) => { e.target.files && form.setValue('registryDoc', e.target.files[0])}} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                   <FormField control={form.control} name="landBookDoc" render={({ field: { onBlur, name, ref } }) => (
                        <FormItem>
                            <FormLabel>Land Book Document</FormLabel>
                            <FormControl><Input type="file" onBlur={onBlur} name={name} ref={ref} onChange={(e) => { e.target.files && form.setValue('landBookDoc', e.target.files[0])}} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                   <FormField control={form.control} name="aadhaarDoc" render={({ field: { onBlur, name, ref } }) => (
                        <FormItem>
                            <FormLabel>Aadhaar Card</FormLabel>
                            <FormControl><Input type="file" onBlur={onBlur} name={name} ref={ref} onChange={(e) => { e.target.files && form.setValue('aadhaarDoc', e.target.files[0])}} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                   <FormField control={form.control} name="panDoc" render={({ field: { onBlur, name, ref } }) => (
                        <FormItem>
                            <FormLabel>PAN Card (Optional)</FormLabel>
                            <FormControl><Input type="file" onBlur={onBlur} name={name} ref={ref} onChange={(e) => { e.target.files && form.setValue('panDoc', e.target.files[0])}} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              Enter the final sale price and date for &quot;
              {selectedProperty && `${selectedProperty.address.street}, ${selectedProperty.address.city}`}
              &quot;. This action will move the property to your Sales History.
            </DialogDescription>
          </DialogHeader>
          <Form {...soldForm}>
            <form onSubmit={soldForm.handleSubmit(onSoldSubmit)} className="space-y-4 pt-4">
                <FormField control={soldForm.control} name="soldPrice" render={({ field }) => (
                    <FormItem><FormLabel>Final Sale Price (₹)</FormLabel><FormControl><Input type="number" placeholder="6500000" {...field} /></FormControl><FormMessage /></FormItem>
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

    