
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
import { format, parseISO } from 'date-fns'
import {
    Calendar as CalendarIcon,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Loader2,
    Pencil,
    PlusCircle,
    Search,
    Trash2
} from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
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
import { Badge, BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useAuth } from '../layout'

const prospectSchema = z.object({
  dealName: z.string().min(3, { message: "Deal name must be at least 3 characters." }),
  source: z.string().min(2, { message: "Source is required." }),
  status: z.enum(['New', 'Under Review', 'Offer Made', 'Rejected', 'Converted']),
  estimatedValue: z.coerce.number().positive({ message: 'Must be a positive number' }).min(1),
  dateAdded: z.date({ required_error: "A date is required."}),
});

type ProspectFormData = z.infer<typeof prospectSchema>

export interface Prospect {
  id: string
  ownerUid: string
  dealName: string
  source: string
  status: 'New' | 'Under Review' | 'Offer Made' | 'Rejected' | 'Converted'
  estimatedValue: number
  dateAdded: Timestamp
}

const ProspectStatusBadge = ({ status }: { status: Prospect['status'] }) => {
    const variantMap: Record<Prospect['status'], BadgeProps['variant']> = {
        'New': 'default',
        'Under Review': 'secondary',
        'Offer Made': 'outline', // Choose a suitable variant
        'Converted': 'default', // Consider a success variant if you add one
        'Rejected': 'destructive',
    };
    const colorMap: Record<Prospect['status'], string> = {
        'New': 'bg-blue-500',
        'Under Review': 'bg-yellow-500',
        'Offer Made': 'bg-indigo-500',
        'Converted': 'bg-green-500',
        'Rejected': 'bg-red-500'
    }

    return <Badge variant={variantMap[status]} className={cn(colorMap[status], "text-white")}>{status}</Badge>;
}

export default function ProspectManagerPage() {
    const { user } = useAuth();
    const [prospects, setProspects] = React.useState<Prospect[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = React.useState(false);
    const [selectedProspect, setSelectedProspect] = React.useState<Prospect | null>(null);
    const { toast } = useToast();

    const form = useForm<ProspectFormData>({
        resolver: zodResolver(prospectSchema),
    });

    React.useEffect(() => {
        if (!user || !db) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const prospectsCol = collection(db, 'prospects');
        const q = query(prospectsCol, where('ownerUid', '==', user.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prospectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prospect))
                .sort((a, b) => b.dateAdded.toDate().getTime() - a.dateAdded.toDate().getTime());
            setProspects(prospectsData);
            setIsLoading(false);
        }, (error) => {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to fetch prospects.', variant: 'destructive'});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    const handleAddNew = () => {
        setSelectedProspect(null);
        form.reset({
          dealName: '',
          source: '',
          status: 'New',
          estimatedValue: 0,
          dateAdded: new Date(),
        })
        setIsModalOpen(true);
    };

    const handleEdit = (prospect: Prospect) => {
        setSelectedProspect(prospect);
        form.reset({
            ...prospect,
            dateAdded: prospect.dateAdded.toDate(),
        });
        setIsModalOpen(true);
    };

    const handleDelete = (prospect: Prospect) => {
        setSelectedProspect(prospect);
        setIsAlertOpen(true);
    };
    
    const handleConvert = (prospect: Prospect) => {
        setSelectedProspect(prospect);
        setIsConvertModalOpen(true);
    }

    const confirmDelete = async () => {
        if (!selectedProspect || !db) return;
        try {
            await deleteDoc(doc(db, 'prospects', selectedProspect.id));
            toast({ title: "Prospect deleted.", description: `"${selectedProspect.dealName}" was removed.`});
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete prospect.", variant: 'destructive' });
        } finally {
            setIsAlertOpen(false);
            setSelectedProspect(null);
        }
    };
    
    const confirmConvert = async () => {
        if (!selectedProspect || !db) return;
        // This would ideally trigger a Cloud Function to create a new Property
        // and link it. For now, we'll just update the status.
        try {
            await updateDoc(doc(db, 'prospects', selectedProspect.id), { status: 'Converted' });
            toast({ title: "Success", description: "Prospect converted to Property."});
        } catch (error) {
            toast({ title: "Error", description: "Failed to convert prospect.", variant: 'destructive' });
        } finally {
            setIsConvertModalOpen(false);
            setSelectedProspect(null);
        }
    }

    const handleFormSubmit = async (data: ProspectFormData) => {
        if (!user || !db) return;
        setIsSubmitting(true);
        const submissionData = { ...data, ownerUid: user.uid, dateAdded: Timestamp.fromDate(data.dateAdded) };
        try {
            if (selectedProspect) {
                await updateDoc(doc(db, 'prospects', selectedProspect.id), submissionData);
                toast({ title: "Success", description: "Prospect updated successfully."});
            } else {
                await addDoc(collection(db, 'prospects'), submissionData);
                toast({ title: "Success", description: "New prospect added."});
            }
            setIsModalOpen(false);
            setSelectedProspect(null);
        } catch(error) {
            toast({ title: "Error", description: "Failed to save prospect.", variant: 'destructive'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const TableSkeleton = () => (
        <>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                </TableRow>
            ))}
        </>
    );

    return (
        <>
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Prospect Manager</h1>
                    <Button onClick={handleAddNew}><PlusCircle className="mr-2" />Add Prospect</Button>
                </div>
                
                <div className="border shadow-sm rounded-lg">
                    <div className="p-4 border-b">
                         <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by deal name..." className="pl-10" />
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Deal Name</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date Added</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableSkeleton />
                            ) : prospects.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No prospects found. Add one to get started!</TableCell></TableRow>
                            ) : (
                                prospects.map(prospect => (
                                    <TableRow key={prospect.id}>
                                        <TableCell className="font-medium">{prospect.dealName}</TableCell>
                                        <TableCell>{prospect.source}</TableCell>
                                        <TableCell><ProspectStatusBadge status={prospect.status} /></TableCell>
                                        <TableCell>{format(prospect.dateAdded.toDate(), 'PP')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {prospect.status !== 'Converted' && prospect.status !== 'Rejected' && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleConvert(prospect)}><CheckCircle className="h-4 w-4"/></Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(prospect)}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(prospect)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                     <div className="p-4 border-t flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                            Showing <strong>1-{prospects.length}</strong> of <strong>{prospects.length}</strong> prospects
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled><ChevronsLeft className="h-4 w-4" /> First</Button>
                            <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" /> Previous</Button>
                            <Button variant="outline" size="sm" disabled>Next <ChevronRight className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" disabled>Last <ChevronsRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
            </main>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedProspect ? 'Edit Prospect' : 'Add New Prospect'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                             <FormField control={form.control} name="dealName" render={({ field }) => (
                                <FormItem><FormLabel>Deal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="source" render={({ field }) => (
                                <FormItem><FormLabel>Source</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {['New', 'Under Review', 'Offer Made', 'Rejected', 'Converted'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                                <FormItem><FormLabel>Estimated Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="dateAdded" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Date Added</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the prospect "{selectedProspect?.dealName}".</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedProspect(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete Prospect</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
                 <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Convert Prospect to Property?</AlertDialogTitle><AlertDialogDescription>This will mark "{selectedProspect?.dealName}" as 'Converted' and it can be managed from the Properties page.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedProspect(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmConvert}>Yes, Convert</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
