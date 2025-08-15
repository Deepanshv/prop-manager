
'use client'

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { Building, Edit, Loader2, MoreHorizontal, Plus, Trash, Undo2, Users, MapPin, Building2 } from 'lucide-react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { useAuth } from '@/app/(app)/layout'
import { useRouter } from 'next/navigation'
import type { Property } from '@/app/(app)/properties/page'
import { ProspectForm, ProspectFormData } from '@/components/prospect-form'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { format } from 'date-fns'

interface ProspectAddress {
  street: string
  city: string
  state: string
  zip: string
  landmark?: string
  latitude?: number
  longitude?: number
}

export interface Prospect {
  id: string
  name: string
  ownerUid: string
  status: 'New' | 'Converted' | 'Canceled'
  dateAdded: Timestamp
  propertyType?: Property['propertyType']
  address?: ProspectAddress
  contactInfo?: string
}

const ProspectCard = React.memo(({ prospect, onDelete, onEdit }: { prospect: Prospect; onDelete: (p: Prospect) => void; onEdit: (p: Prospect) => void }) => {
  const router = useRouter();
  const getStatusBadgeClass = (status: Prospect['status']) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500 hover:bg-blue-500/80 text-primary-foreground'
      case 'Converted':
        return 'bg-green-500 hover:bg-green-500/80 text-primary-foreground'
      case 'Canceled':
        return 'bg-destructive hover:bg-destructive/80 text-destructive-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <Card 
        className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => router.push(`/prospects/${prospect.id}`)}
    >
      <div 
        className="flex-grow flex flex-col hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <CardHeader>
          <CardTitle className="text-lg line-clamp-1">{prospect.name}</CardTitle>
          {prospect.address && (
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {prospect.address.city || prospect.address.state ? `${prospect.address.city}, ${prospect.address.state}` : 'Location not set'}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-2 min-h-20">
            <div className="text-sm flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{prospect.propertyType}</span>
            </div>
            <div className="text-sm text-muted-foreground">
                Added on {format(prospect.dateAdded.toDate(), 'PPP')}
            </div>
            {prospect.contactInfo && (
                <p className="text-sm text-muted-foreground pt-1 truncate">
                    <strong>Source:</strong> {prospect.contactInfo}
                </p>
            )}
        </CardContent>
      </div>
      <CardFooter className="bg-muted/50 p-4 flex justify-between items-center text-sm border-t">
        <div>
          <p className="text-muted-foreground">Status</p>
          <Badge className={cn("font-semibold", getStatusBadgeClass(prospect.status))}>
            {prospect.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(prospect)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Details
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
      where('ownerUid', '==', user.uid)
    )
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Prospect[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Prospect, 'id'>;
          props.push({ id: doc.id, ...data } as Prospect)
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

  const confirmDelete = async () => {
    if (!selectedProspect || !db) return

    try {
      await deleteDoc(doc(db!, 'prospects', selectedProspect.id))
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
             const prospectDocRef = doc(db!, 'prospects', editingProspect.id);
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

  return (
    <>
      <div className="space-y-6 p-6">
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
                onEdit={handleEditProspect}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-muted-foreground">No Active Prospects Found</h2>
            <p className="mt-2 text-muted-foreground">{db ? 'Add a new prospect to get started.' : 'Firebase not configured. Please check your environment.'}</p>
          </div>
        )}
      </div>

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
              initialData={editingProspect ? {
                name: editingProspect.name,
                propertyType: (editingProspect.propertyType as string) || 'Open Land',
                address: editingProspect.address || { street: '', city: '', state: '', zip: '' },
                contactInfo: editingProspect.contactInfo || '',
                status: editingProspect.status,
              } : undefined}
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
