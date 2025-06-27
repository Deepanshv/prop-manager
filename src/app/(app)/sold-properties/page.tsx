
'use client'

import * as React from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import type { Property } from '../properties/page'

export default function SoldPropertiesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [soldProperties, setSoldProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'properties'),
      where('ownerUid', '==', user.uid),
      where('status', '==', 'Sold'),
      orderBy('soldDate', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = []
        querySnapshot.forEach((doc) => {
          props.push({ id: doc.id, ...doc.data() } as Property)
        })
        setSoldProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching sold properties: ', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch sold properties.',
          variant: 'destructive',
        })
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, toast])

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return 'N/A'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const TableSkeleton = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  )

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Sold Properties History</h1>
        <div className="flex items-center gap-2">
            <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="border shadow-sm rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property Address</TableHead>
              <TableHead>Sold Date</TableHead>
              <TableHead>Purchase Price</TableHead>
              <TableHead>Sold Price</TableHead>
              <TableHead className="text-right">Profit / Loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : soldProperties.length > 0 ? (
              soldProperties.map((prop) => {
                const profitLoss = (prop.soldPrice || 0) - prop.purchasePrice
                return (
                  <TableRow key={prop.id}>
                    <TableCell className="font-medium">
                      {`${prop.address.street}, ${prop.address.city}`}
                    </TableCell>
                    <TableCell>
                      {prop.soldDate ? format(prop.soldDate.toDate(), 'PPP') : 'N/A'}
                    </TableCell>
                    <TableCell>{formatCurrency(prop.purchasePrice)}</TableCell>
                    <TableCell>{formatCurrency(prop.soldPrice)}</TableCell>
                    <TableCell className={cn(
                        "text-right font-semibold",
                        profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatCurrency(profitLoss)}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  You have not recorded any sold properties yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-4 border-t flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
                Showing <strong>1-{soldProperties.length}</strong> of <strong>{soldProperties.length}</strong> sales
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" /> Previous</Button>
                <Button variant="outline" size="sm" disabled>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
        </div>
      </div>
    </main>
  )
}
