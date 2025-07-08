
'use client'
import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Badge } from "@/components/ui/badge"
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  IndianRupee,
  Users,
  ExternalLink,
} from "lucide-react"
import { useAuth } from './layout'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { Property } from './properties/page'
import type { Prospect } from './prospects/page'
import { CardDescription as Description } from '@/components/ui/card'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const PropertiesMap = dynamic(() => import('@/components/properties-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [allProperties, setAllProperties] = React.useState<Property[]>([])
  const [prospects, setProspects] = React.useState<Prospect[]>([])
  const [loading, setLoading] = React.useState(true)
  const [focusedPropertyId, setFocusedPropertyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    const propertyQuery = query(collection(db, 'properties'), where('ownerUid', '==', user.uid))
    const prospectQuery = query(collection(db, 'prospects'), where('ownerUid', '==', user.uid))
    
    let isMounted = true;
    let initialLoads = 2; // for properties and prospects

    const handleInitialLoad = () => {
        initialLoads--;
        if (initialLoads <= 0 && isMounted) {
            setLoading(false);
        }
    }

    const unsubProperties = onSnapshot(propertyQuery, (snapshot) => {
      if (!isMounted) return;
      const props = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property))
      setAllProperties(props)
      handleInitialLoad();
    }, (error) => {
      console.error("Error fetching properties:", error)
      toast({ title: 'Error', description: 'Could not fetch properties.', variant: 'destructive'})
      if (isMounted) handleInitialLoad();
    })

    const unsubProspects = onSnapshot(prospectQuery, (snapshot) => {
      if (!isMounted) return;
      const pros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prospect))
      setProspects(pros)
      handleInitialLoad();
    }, (error) => {
      console.error("Error fetching prospects:", error)
      toast({ title: 'Error', description: 'Could not fetch prospects.', variant: 'destructive'})
      if (isMounted) handleInitialLoad();
    })

    return () => {
      isMounted = false;
      unsubProperties()
      unsubProspects()
    }
  }, [user, toast])

  const activeProperties = React.useMemo(() => allProperties.filter(p => p.status !== 'Sold'), [allProperties]);

  const portfolioValue = activeProperties.reduce((sum, prop) => sum + (prop.purchasePrice || 0), 0)
  const activeProspects = prospects.filter(p => p.status === 'New' || p.status === 'Under Review' || p.status === 'Offer Made').length
  
  const recentActivity = React.useMemo(() => {
    return [...allProperties]
        .sort((a, b) => {
            const dateA = a.status === 'Sold' && a.soldDate ? a.soldDate.toDate().getTime() : a.purchaseDate.toDate().getTime();
            const dateB = b.status === 'Sold' && b.soldDate ? b.soldDate.toDate().getTime() : b.purchaseDate.toDate().getTime();
            return dateB - dateA;
        })
        .slice(0, 5);
  }, [allProperties]);

  const kpis = [
    { title: "Total Properties", value: activeProperties.length, icon: Building2, format: (v: number) => v.toLocaleString() },
    { title: "Active Prospects", value: activeProspects, icon: Users, format: (v: number) => v.toLocaleString() },
    { title: "Portfolio Value", value: portfolioValue, icon: IndianRupee, format: (v: number) => `₹${(v / 10000000).toFixed(2)} Cr` },
  ]
  
  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                <div className="text-2xl font-bold">{kpi.format(kpi.value)}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="h-[400px]">
        <PropertiesMap properties={allProperties} focusedPropertyId={focusedPropertyId} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <Description>Click on a property to view its location on the map.</Description>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[150px] text-right">Date</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-6 w-24 rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <TableRow 
                    key={activity.id}
                    className="cursor-pointer"
                    onClick={() => {
                        if (activity.address.latitude && activity.address.longitude) {
                            setFocusedPropertyId(activity.id);
                        } else {
                            toast({
                                title: 'Location Not Set',
                                description: `The location for "${activity.name}" has not been set. Please edit the property to set it on the map.`,
                                variant: 'destructive',
                            })
                        }
                    }}
                  >
                    <TableCell className="font-medium">{activity.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        className={cn(
                          activity.status === 'For Sale' && 'bg-primary text-primary-foreground hover:bg-primary/80',
                          activity.status === 'Sold' && 'bg-chart-2 text-primary-foreground hover:bg-chart-2/80',
                          (activity.status === 'Owned' || !activity.status) && 'bg-[#644117] text-white hover:bg-[#644117]/90'
                        )}
                      >
                        {activity.status || 'Owned'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(activity.status === 'Sold' && activity.soldDate ? activity.soldDate.toDate() : activity.purchaseDate.toDate(), "PP")}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} title="View Details">
                            <Link href={`/properties/${activity.id}`}>
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">View Details</span>
                            </Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No recent activity.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
