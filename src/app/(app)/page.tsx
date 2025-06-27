
'use client'
import * as React from 'react'
import { Badge } from "@/components/ui/badge"
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
  DollarSign,
  Users,
} from "lucide-react"
import { useAuth } from './layout'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { Property } from './properties/page'
import type { Prospect } from './prospects/page'
import Link from 'next/link'
import dynamic from 'next/dynamic'

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [prospects, setProspects] = React.useState<Prospect[]>([])
  const [recentActivity, setRecentActivity] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)

  const PropertiesMap = React.useMemo(() => dynamic(
    () => import('@/components/properties-map'),
    { 
      loading: () => <Skeleton className="h-full w-full rounded-none" />,
      ssr: false 
    }
  ), []);

  React.useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    const propertyQuery = query(collection(db, 'properties'), where('ownerUid', '==', user.uid))
    const prospectQuery = query(collection(db, 'prospects'), where('ownerUid', '==', user.uid))
    const activityQuery = query(collection(db, 'properties'), where('ownerUid', '==', user.uid), orderBy('purchaseDate', 'desc'), limit(5))

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
      setProperties(props)
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
    
    const unsubActivity = onSnapshot(activityQuery, (snapshot) => {
      if (!isMounted) return;
      const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property))
      setRecentActivity(activities)
    }, (error) => {
        console.error("Error fetching recent activity:", error)
    })

    return () => {
      isMounted = false;
      unsubProperties()
      unsubProspects()
      unsubActivity()
    }
  }, [user, toast])

  const portfolioValue = properties.reduce((sum, prop) => sum + (prop.purchasePrice || 0), 0)
  const activeProspects = prospects.filter(p => p.status === 'New' || p.status === 'Under Review' || p.status === 'Offer Made').length

  const kpis = [
    { title: "Total Properties", value: properties.length, icon: Building2, format: (v: number) => v.toLocaleString() },
    { title: "Active Prospects", value: activeProspects, icon: Users, format: (v: number) => v.toLocaleString() },
    { title: "Portfolio Value", value: portfolioValue, icon: DollarSign, format: (v: number) => `₹${(v / 10000000).toFixed(2)} Cr` },
  ]
  
  const getBadgeVariant = (index: number) => {
    const variants = ["secondary", "outline", "default"]
    return variants[index % variants.length] as "secondary" | "outline" | "default"
  }
  
  const getActivityStatus = (index: number) => {
    const statuses = ["New Property", "Lease Signed", "New Prospect"]
    return statuses[index % statuses.length]
  }

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

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Map</CardTitle>
          <CardDescription>
            Your properties pinned on a map. Add coordinates to see them.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[450px] p-0">
          <PropertiesMap properties={properties} />
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{`${activity.address.street}, ${activity.address.city}`}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(index)}>
                        {getActivityStatus(index)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(activity.purchaseDate.seconds * 1000).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
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
