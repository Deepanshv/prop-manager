
'use client'

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { Building, Loader2, MapPin, MoreHorizontal, Plus, Trash, Undo2, View } from 'lucide-react'
import * as React from 'react'
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { useAuth } from '../layout'
import { useRouter } from 'next/navigation'
import type { Property } from '@/app/(app)/properties/page'
import { ProspectForm, ProspectFormData } from '@/components/prospect-form'

export interface Prospect extends Partial<Property> {
  id: string
  ownerUid: string
  status: 'New'
  dateAdded: Timestamp
}

const ProspectCard = React.memo(({ prospect, onDelete, onConvert }: { prospect: Prospect; onDelete: (p: Prospect) => void; onConvert: (p: Prospect) => void }) => {
  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <div className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg p-6 space-y-2">
        <CardTitle className="text-lg">{prospect.name}</CardTitle>
        {prospect.address && (
          <CardDescription className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {prospect.address.city && prospect.address.state
              ? `${prospect.address.city}, ${prospect.address.state}`
              : 'Location not set'}
          </CardDescription>
        )}
      </div>
      <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-semibold text-base">New Prospect</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onConvert(prospect)}>
                <Undo2 className="mr-2 h-4 w-4" /> Convert to Property
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(prospect)} className="text-destructive focus:text-destructive">
                <Trash className="mr-2 h-4 w-4" /> Delete Prospect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  )
})
ProspectCard.displayName = 'ProspectCard'

const PageSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="flex flex-col">
        <div className="flex-grow p-6 space-y-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
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

export default function ProspectManagerPage() {
  const { user } = useAuth()
  const [prospects, setProspects] = React.useState<Prospect[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [selectedProspect, setSelectedProspect] = React.useState<Prospect | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()
  const router = useRouter()

  React.useEffect(() => {
    if (!user || !db) {
      setProspects([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(collection(db, 'prospects'), where('ownerUid', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Prospect[] = []
        querySnapshot.forEach((doc) => {
          props.push({ id: doc.id, ...doc.data() } as Prospect)
        })
        setProspects(props.sort((a, b) => b.dateAdded.toDate().getTime() - a.dateAdded.toDate().getTime()))
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching prospects: ', error)
        toast({ title: 'Error', description: 'Failed to fetch prospects.', variant: 'destructive' })
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [user, toast])

  const handleAddProspect = () => {
    setIsModalOpen(true)
  }

  const handleDeleteProspect = React.useCallback((prospect: Prospect) => {
    setSelectedProspect(prospect)
    setIsDeleteAlertOpen(true)
  }, [])

  const handleConvertProspect = React.useCallback(async (prospect: Prospect) => {
    if (!user || !db) return;

    const toastId = toast({
      title: 'Converting Prospect...',
      description: `Please wait while "${prospect.name}" is converted to a property.`,
    });

    try {
      const newPropertyRef = doc(collection(db, 'properties'))

      const newPropertyData: Omit<Property, 'id'> = {
        name: prospect.name,
        ownerUid: user.uid,
        address: prospect.address || { street: '', city: '', state: '', zip: '' },
        landDetails: { area: 0, areaUnit: 'Square Feet' },
        propertyType: 'Open Land',
        purchaseDate: Timestamp.now(),
        purchasePrice: 0,
        status: 'Owned',
      }
      
      await setDoc(newPropertyRef, newPropertyData)
      await deleteDoc(doc(db, 'prospects', prospect.id))

      toastId.update({
        id: toastId.id,
        title: 'Conversion Successful',
        description: `Prospect converted. You will now be redirected to the property details page.`,
      })
      
      router.push(`/properties/${newPropertyRef.id}`)
      
    } catch(error: any) {
        console.error('Error converting prospect:', error);
        toastId.update({
            id: toastId.id,
            title: 'Conversion Failed',
            description: 'Could not convert the prospect to a property.',
            variant: 'destructive',
        });
    }

  }, [user, db, toast, router]);

  const confirmDelete = async () => {
    if (!selectedProspect || !db) return

    try {
      await deleteDoc(doc(db, 'prospects', selectedProspect.id))
      toast({ title: 'Success', description: 'Prospect deleted successfully.' })
    } catch (error) {
      console.error('Error deleting document: ', error)
      toast({ title: 'Error', description: 'Failed to delete prospect.', variant: 'destructive' })
    } finally {
      setIsDeleteAlertOpen(false)
      setSelectedProspect(null)
    }
  }

  const onSubmit = async (data: ProspectFormData) => {
    if (!user || !db) {
      toast({ title: 'Error', description: 'Cannot save prospect.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    try {
      const newProspectRef = doc(collection(db, 'prospects'))
      const prospectData: Omit<Prospect, 'id'> = {
        name: data.name,
        address: data.address,
        ownerUid: user.uid,
        status: 'New' as const,
        dateAdded: Timestamp.now(),
      }

      await setDoc(newProspectRef, prospectData)
      toast({ title: 'Success', description: 'Prospect added successfully.' })
      setIsModalOpen(false)
    } catch (error: any) {
      console.error('Error during prospect creation: ', error)
      toast({ title: 'Error', description: error.message || 'Failed to save prospect. Please try again.', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Prospects</h1>
          <Button onClick={handleAddProspect}>
            <Plus className="mr-2 h-4 w-4" /> Add Prospect
          </Button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : prospects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prospects.map((prop) => (
              <ProspectCard key={prop.id} prospect={prop} onDelete={handleDeleteProspect} onConvert={handleConvertProspect} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-xl font-semibold text-muted-foreground">No Prospects Found</h2>
            <p className="mt-2 text-muted-foreground">{db ? 'Add a new prospect to get started!' : 'Firebase not configured. Please check your environment.'}</p>
          </div>
        )}
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Prospect</DialogTitle>
            <DialogDescription>Fill in the basic details for a new prospect. More details can be added after converting it to a property.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto pr-4 pt-4">
            <ProspectForm
              onSubmit={onSubmit}
              isSaving={isSaving}
              submitButtonText="Save Prospect"
            >
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
            </ProspectForm>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the prospect.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProspect(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
