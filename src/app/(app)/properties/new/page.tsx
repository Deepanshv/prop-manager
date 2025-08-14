
'use client'

import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { useAuth } from '../../layout'
import { PropertyForm, type PropertyFormData } from '@/components/property-form'


export default function NewPropertyPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)

  const onSubmit = async (data: PropertyFormData) => {
    if (!user || !db) {
      toast({ title: 'Error', description: 'Cannot save property.', variant: 'destructive' })
      return
    }
    setIsSaving(true)

    const propertyData: Record<string, any> = {
        ...data,
        ownerUid: user.uid,
        purchaseDate: Timestamp.fromDate(data.purchaseDate),
        landType: data.landType || null,
        remarks: data.remarks || null,
        status: 'Owned',
        isListedPublicly: false,
        listingPrice: null,
        soldPrice: null,
        soldDate: null,
    };

    try {
      await addDoc(collection(db, 'properties'), propertyData)
      toast({ title: 'Success', description: 'Property created successfully.' })
      router.push('/properties')
    } catch (error) {
      console.error('Error creating document: ', error)
      toast({ title: 'Error', description: 'Failed to create property.', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Add New Property</h1>
      </div>
      
        <Card className="mt-4">
            <CardHeader>
                <CardTitle>New Property Details</CardTitle>
                <CardDescription>Fill in the form below to create a new property record.</CardDescription>
            </CardHeader>
            <CardContent>
                <PropertyForm 
                    mode="add"
                    onSubmit={onSubmit}
                    isSaving={isSaving}
                    submitButtonText="Create Property"
                >
                   <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                </PropertyForm>
            </CardContent>
        </Card>
    </div>
  )
}

    