
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const prospectSchema = z.object({
  dealName: z.string().min(3, { message: "Deal name must be at least 3 characters." }),
  source: z.string().min(2, { message: "Source is required." }),
  estimatedValue: z.coerce.number().positive({ message: 'Must be a positive number' }).min(1),
  dateAdded: z.date({ required_error: "A date is required."}),
  status: z.enum(['New', 'Converted']),
});

export type ProspectFormData = z.infer<typeof prospectSchema>

interface ProspectFormProps {
    onSubmit: (data: ProspectFormData) => void;
    initialData?: Partial<ProspectFormData>;
    isSaving: boolean;
    mode: 'add' | 'edit';
    children?: React.ReactNode;
}

export function ProspectForm({ onSubmit, initialData, isSaving, mode, children }: ProspectFormProps) {
  const form = useForm<ProspectFormData>({
    resolver: zodResolver(prospectSchema),
    defaultValues: initialData || {
      dealName: '',
      source: '',
      estimatedValue: 0,
      dateAdded: new Date(),
      status: 'New',
    }
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);
  
  const submitButtonText = mode === 'add' ? 'Add Prospect' : 'Save Changes';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Prospect Details</h3>
          <div className="border p-4 rounded-md grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
            <FormField control={form.control} name="dealName" render={({ field }) => (
                <FormItem className="md:col-span-2">
                    <FormLabel>Deal Name</FormLabel>
                    <FormControl><Input placeholder="e.g. South Mumbai Sea View Flat" {...field} value={field.value ?? ''} /></FormControl>
                    <FormDescription>A descriptive name for this potential deal.</FormDescription>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="source" render={({ field }) => (
                <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl><Input placeholder="e.g. Real Estate Agent, Zillow" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
             <FormField control={form.control} name="dateAdded" render={({ field }) => (
                <FormItem>
                    <FormLabel>Date Added</FormLabel>
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
            )} />
             <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                <FormItem className="md:col-span-2">
                    <FormLabel>Estimated Value (₹)</FormLabel>
                    <FormControl><Input type="number" placeholder="10000000" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={Number.isNaN(field.value) ? '' : field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            {mode === 'edit' && (
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Prospect Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="New">New</SelectItem>
                                    <SelectItem value="Converted">Converted</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
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
