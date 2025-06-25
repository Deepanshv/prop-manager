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
import { User, onAuthStateChanged } from 'firebase/auth'
import { format } from 'date-fns'
import {
  Building2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  Settings,
  Trash,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { auth, db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { FileManager } from '@/components/file-manager'

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/properties", icon: Building2, label: "Properties" },
  { href: "#", icon: Users, label: "Prospects" },
  { href: "#", icon: Settings, label: "Settings" },
]

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
})

type PropertyFormData = z.infer<typeof propertyFormSchema>

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
}

export default function PropertyManagerPage() {
  const [user, setUser] = React.useState<User | null>(null)
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)
  const { toast } = useToast()

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
  })

  React.useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

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
          props.push({ id: doc.id, ...doc.data() } as Property)
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
    setSelectedProperty(null)
    form.reset({
      address: { street: '', city: '', state: '', zip: '' },
      purchasePrice: 0,
    })
    setIsModalOpen(true)
  }

  const handleEditProperty = (property: Property) => {
    setSelectedProperty(property)
    form.reset({
      ...property,
      purchaseDate: property.purchaseDate.toDate(),
    })
    setIsModalOpen(true)
  }

  const handleDeleteProperty = (property: Property) => {
    setSelectedProperty(property)
    setIsDeleteAlertOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedProperty) return

    if (!db) {
      toast({ title: 'Error', description: 'Database not configured.', variant: 'destructive' })
      setIsDeleteAlertOpen(false)
      return
    }
      
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
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' })
      return
    }

    if (!db) {
      toast({ title: 'Database Error', description: 'Firebase is not configured correctly.', variant: 'destructive' })
      return
    }

    const propertyData = {
      ...data,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      ownerUid: user.uid,
    }

    try {
      if (selectedProperty) {
        // Update
        const propDocRef = doc(db, 'properties', selectedProperty.id)
        await updateDoc(propDocRef, propertyData)
        toast({ title: 'Success', description: 'Property updated successfully.' })
      } else {
        // Create
        await addDoc(collection(db, 'properties'), propertyData)
        toast({ title: 'Success', description: 'Property added successfully.' })
      }
      setIsModalOpen(false)
      setSelectedProperty(null)
    } catch (error) {
      console.error('Error writing document: ', error)
      toast({ title: 'Error', description: 'Failed to save property.', variant: 'destructive' })
    }
  }

  const TableSkeleton = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
           <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Property-Manager</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item, index) => (
              <SidebarMenuItem key={item.label}>
                 <SidebarMenuButton asChild tooltip={item.label} isActive={index === 1}>
                  <a href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <div className="flex items-center gap-3 p-2 rounded-md transition-colors w-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="user avatar" />
              <AvatarFallback>PM</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-sm overflow-hidden">
              <span className="font-semibold truncate">Pat Manager</span>
              <span className="text-muted-foreground truncate">pat.manager@example.com</span>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Log Out">
                <LogOut />
                <span>Log Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:justify-end">
          <SidebarTrigger className="md:hidden">
            <PanelLeft />
          </SidebarTrigger>
        </header>

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
                            <DropdownMenuItem onClick={() => handleEditProperty(prop)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
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
                    <TableCell colSpan={5} className="h-24 text-center">
                      {!auth || !db ? "Firebase not configured. Please add credentials to your environment file." : user ? 'No properties found. Add one to get started!' : 'Please sign in to view your properties.'}
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
                    <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    <Button variant="outline" size="sm">Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>
          </div>
        </main>
      </SidebarInset>

      {/* Add/Edit Property Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            <DialogDescription>
              {selectedProperty ? 'Update the details of your property.' : 'Fill in the form to add a new property to your portfolio.'}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className={cn(!selectedProperty && 'hidden')}>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
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
                        <FormItem className="flex flex-col">
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
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Property</Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
            {selectedProperty && (
                <TabsContent value="files">
                    <div className="pt-4">
                        <FileManager entityType="properties" entityId={selectedProperty.id} />
                    </div>
                </TabsContent>
            )}
          </Tabs>
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
    </SidebarProvider>
  )
}
