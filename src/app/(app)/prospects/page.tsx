
'use client'

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { Building, Edit, Loader2, MoreHorizontal, Plus, Trash, Undo2, Users } from 'lucide-react'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { useAuth } from '../layout'
import { useRouter } from 'next/navigation'
import type { Property } from '@/app/(app)/properties/page'
import { ProspectForm, ProspectFormData } from '@/components/prospect-form'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export interface Prospect extends Partial<Property> {
  id: string
  ownerUid: string
  status: 'New' | 'Converted' | 'Rejected'
  dateAdded: Timestamp
  contactInfo?: string
}

const ProspectCard = React.memo(({ prospect, onDelete, onStatusChange, onEdit }: { prospect: Prospect; onDelete: (p: Prospect) => void; onStatusChange: (p: Prospect, status: Prospect['status']) => void, onEdit: (p: Prospect) => void }) => {
  const getStatusBadgeClass = (status: Prospect['status']) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500 hover:bg-blue-500/80 text-primary-foreground'
      case 'Converted':
        return 'bg-green-500 hover:bg-green-500/80 text-primary-foreground'
      case 'Rejected':
        return 'bg-destructive hover:bg-destructive/80 text-destructive-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <Link 
        href={`/prospects/${prospect.id}`}
        className="flex-grow flex flex-col p-6 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <CardTitle className="text-lg">{prospect.name}</CardTitle>
        {prospect.address && (
          <CardDescription className="flex items-center gap-1">
             {prospect.address.city || prospect.address.state ? `${prospect.address.city}, ${prospect.address.state}` : 'Location not set'}
          </CardDescription>
        )}
        {prospect.contactInfo && (
            <p className="text-sm text-muted-foreground pt-2">
                <strong>Source:</strong> {prospect.contactInfo}
            </p>
        )}
      </Link>
      <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
        <div>
          <p className="text-muted-foreground">Status</p>
          <Badge className={cn("font-semibold", getStatusBadgeClass(prospect.status))}>
            {prospect.status}
          </Badge>
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
              <DropdownMenuItem onClick={() => onEdit(prospect)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Details
              </DropdownMenuItem>
               <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span>Change Status</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={prospect.status}
                    onValueChange={(newStatus) => onStatusChange(prospect, newStatus as Prospect['status'])}
                  >
                    <DropdownMenuRadioItem value="New">New</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Converted">Converted</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Rejected">Rejected</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
  const [editingProspect, setEditingProspect] = React.useState<Prospect | null>(null)
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
    const q = query(
      collection(db, 'prospects'), 
      where('ownerUid', '==', user.uid),
      where('status', '==', 'New')
    )
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
    setEditingProspect(null);
    setIsModalOpen(true);
  }

  const handleEditProspect = React.useCallback((prospect: Prospect) => {
    router.push(`/prospects/${prospect.id}`);
  }, [router]);

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
        landDetails: prospect.landDetails || { area: 0, areaUnit: 'Square Feet' },
        propertyType: prospect.propertyType || 'Open Land',
        purchaseDate: Timestamp.now(),
        purchasePrice: 0,
        status: 'Owned',
        remarks: prospect.contactInfo ? `Contact Info: ${prospect.contactInfo}` : '',
      }
      
      await setDoc(newPropertyRef, newPropertyData)
      
      const prospectDocRef = doc(db, 'prospects', prospect.id);
      await updateDoc(prospectDocRef, { status: 'Converted' });

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

    const prospectDataToSave = {
        ...data,
        contactInfo: data.contactInfo || null,
    };

    try {
        if (editingProspect) {
             const prospectDocRef = doc(db, 'prospects', editingProspect.id);
             await updateDoc(prospectDocRef, prospectDataToSave);
             toast({ title: 'Success', description: 'Prospect updated successfully.' });
        } else {
             const newProspectRef = doc(collection(db, 'prospects'));
            const newProspectData = {
                ...prospectDataToSave,
                ownerUid: user.uid,
                status: 'New' as const,
                dateAdded: Timestamp.now(),
            };
             await setDoc(newProspectRef, newProspectData);
             toast({ title: 'Success', description: 'Prospect added successfully.' });
        }
      setIsModalOpen(false)
      setEditingProspect(null)
    } catch (error: any) {
      console.error('Error during prospect save: ', error)
      toast({ title: 'Error', description: error.message || 'Failed to save prospect. Please try again.', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleStatusChange = async (prospect: Prospect, status: Prospect['status']) => {
    if (status === 'Converted') {
        handleConvertProspect(prospect);
        return;
    }
    
    if (!db) return;
    try {
        const prospectDocRef = doc(db, 'prospects', prospect.id);
        await updateDoc(prospectDocRef, { status });
        toast({ title: 'Status Updated', description: `Prospect status changed to "${status}".` });
    } catch (error) {
        console.error('Error updating status:', error);
        toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

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
              <ProspectCard
                key={prop.id}
                prospect={prop}
                onDelete={handleDeleteProspect}
                onStatusChange={handleStatusChange}
                onEdit={handleEditProspect}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-muted-foreground">No Active Prospects Found</h2>
            <p className="mt-2 text-muted-foreground">{db ? 'Add a new prospect or check your rejected list.' : 'Firebase not configured. Please check your environment.'}</p>
          </div>
        )}
      </main>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
          if (!open) {
              setEditingProspect(null);
          }
          setIsModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingProspect ? 'Edit Prospect' : 'Add New Prospect'}</DialogTitle>
            <DialogDescription>{editingProspect ? 'Update the details for this prospect.' : 'Fill in the basic details for a new prospect.'}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto pr-4 pt-4">
            <ProspectForm
              mode={editingProspect ? 'edit' : 'add'}
              onSubmit={onSubmit}
              isSaving={isSaving}
              initialData={editingProspect || undefined}
              submitButtonText={editingProspect ? "Save Changes" : "Save Prospect"}
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
