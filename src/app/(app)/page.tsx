
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import {
  Building2,
  DollarSign,
  Plus,
  Users,
} from "lucide-react"

const kpis = [
  { title: "Total Properties", value: "1,250", icon: Building2 },
  { title: "Active Prospects", value: "350", icon: Users },
  { title: "Portfolio Value", value: "$150.5M", icon: DollarSign },
]

const recentActivities = [
  { property: "Sunset Villa", status: "New Prospect", date: "28 Jul, 2024" },
  { property: "Ocean Breeze", status: "Lease Signed", date: "27 Jul, 2024" },
  { property: "Mountain View", status: "New Property", date: "26 Jul, 2024" },
  { property: "Downtown Loft", status: "Tour Scheduled", date: "25 Jul, 2024" },
  { property: "Suburban Home", status: "Lease Signed", date: "24 Jul, 2024" },
]

export default function DashboardPage() {
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case "Lease Signed":
        return "default"
      case "New Property":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New Property
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivities.map((activity) => (
                <TableRow key={activity.property}>
                  <TableCell className="font-medium">{activity.property}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(activity.status)}>
                      {activity.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{activity.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
