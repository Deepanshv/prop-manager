
'use client'

import { collection, deleteDoc, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore'
import { Building2, Calendar as CalendarIcon, CheckCircle, Copy, Loader2, MapPin, MoreHorizontal, Trash, View } from 'lucide-react'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'

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
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/firebase'
import type { Property } from '@/app/(app)/properties/page'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const markAsSoldSchema = z.object({
  soldPrice: z.coerce.number().min(1, 'Sold price is required.'),
  soldDate: z.date({ required_error: 'A sold date is required.' }),
})
type MarkAsSoldFormData = z.infer<typeof markAsSoldSchema>

function PropertyCard({
  property,
  onDelete,
  onMarkAsSold,
}: {
  property: Property
  onDelete: (p: Property) => void
  onMarkAsSold: (p: Property) => void
}) {
  const router = useRouter()
  if (!property.listingPrice) return null

  return (
    <Card className="flex flex-col border-t-4 border-primary">
      <Link href={`/properties/${property.id}`} className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg">
        <CardHeader>
          <CardTitle className="text-lg">{property.name}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {`${property.address.street}, ${property.address.city}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{property.propertyType}</span>
          </div>
          <div className="text-sm text-muted-foreground">Size: {`${property.landDetails.area} ${property.landDetails.areaUnit}`}</div>
        </CardContent>
      </Link>
      <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
        <div>
          <p className="text-muted-foreground">Listing Price</p>
          <p className="font-semibold text-base">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(property.listingPrice)}
          </p>
        </div>
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
      </CardFooter>
    </Card>
  )
}

const PageSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
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

export default function InternalListingsPage() {
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [publicUrl, setPublicUrl] = React.useState('')
  const { toast } = useToast()

  const [isSoldModalOpen, setIsSoldModalOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null)

  const soldForm = useForm<MarkAsSoldFormData>({
    resolver: zodResolver(markAsSoldSchema),
  })

  React.useEffect(() => {
    // This effect runs on the client-side, where window is available
    setPublicUrl(`${window.location.origin}/public-listings`)
  }, [])

  React.useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    const q = query(collection(db, 'properties'), where('isListedPublicly', '==', true))

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
        console.error('Error fetching public properties: ', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const copyPublicLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl)
      toast({
        title: 'Link Copied!',
        description: 'The public listings page URL has been copied to your clipboard.',
      })
    }
  }

  const handleDeleteProperty = (property: Property) => {
    setSelectedProperty(property)
    setIsDeleteAlertOpen(true)
  }

  const handleMarkAsSold = (property: Property) => {
    setSelectedProperty(property)
    soldForm.reset({ soldPrice: property.listingPrice || property.purchasePrice, soldDate: new Date() })
    setIsSoldModalOpen(true)
  }

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

  const onSoldSubmit = async (data: MarkAsSoldFormData) => {
    if (!selectedProperty || !db) {
      toast({ title: 'Error', description: 'Cannot update property.', variant: 'destructive' })
      return
    }
    try {
      const propDocRef = doc(db, 'properties', selectedProperty.id)
      await updateDoc(propDocRef, {
        status: 'Sold',
        soldPrice: data.soldPrice,
        soldDate: Timestamp.fromDate(data.soldDate),
        isListedPublicly: false,
      })
      toast({ title: 'Success', description: 'Property marked as sold and moved to Sales History.' })
      setIsSoldModalOpen(false)
      setSelectedProperty(null)
    } catch (error) {
      console.error('Error updating document: ', error)
      toast({ title: 'Error', description: 'Failed to mark property as sold.', variant: 'destructive' })
    }
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-grow">
            <h1 className="text-3xl font-bold tracking-tight">Public Listings</h1>
            <p className="text-muted-foreground">This is your internal view of properties marked as "List Publicly".</p>
          </div>
          <Button onClick={copyPublicLink} disabled={!publicUrl}>
            <Copy className="mr-2 h-4 w-4" /> Copy Shareable Link
          </Button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map((prop) => (
              <PropertyCard key={prop.id} property={prop} onDelete={handleDeleteProperty} onMarkAsSold={handleMarkAsSold} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-muted-foreground">No Public Listings</h2>
            <p className="mt-2 text-muted-foreground">
              To see properties here, go to a property's details page and enable the "List Publicly" switch.
            </p>
          </div>
        )}
      </main>

      <Dialog open={isSoldModalOpen} onOpenChange={setIsSoldModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Property as Sold</DialogTitle>
            <DialogDescription>
              Enter the final sale price and date for &quot;
              {selectedProperty?.name}
              &quot;. This will move the property to Sales History.
            </DialogDescription>
          </DialogHeader>
          <Form {...soldForm}>
            <form onSubmit={soldForm.handleSubmit(onSoldSubmit)} className="space-y-4 pt-4">
              <FormField
                control={soldForm.control}
                name="soldPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Sale Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="6500000"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        value={Number.isNaN(field.value) ? '' : field.value ?? ''}
                      />
                    </FormControl>
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
                          <Button
                            variant="outline"
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
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
                <Button type="button" variant="ghost" onClick={() => setIsSoldModalOpen(false)}>
                  Cancel
                </Button>
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
