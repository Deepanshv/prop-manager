
'use client'

import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { Building2, Globe, History, LayoutDashboard, Loader2, LogOut, PanelLeft, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as React from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'

interface AuthContextType {
  user: User
  handleLogout: () => void
}

const AuthContext = React.createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/prospects", icon: Users, label: "Prospects" },
  { href: "/properties", icon: Building2, label: "Properties" },
  { href: "/sold-properties", icon: History, label: "Sold Properties" },
  { href: "/listings", icon: Globe, label: "Public Listings" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  React.useEffect(() => {
    if (!auth) {
        router.replace('/login');
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
      } else {
        setUser(null)
        router.replace('/login')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])
  
  const handleLogout = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
        toast({ title: 'Signed Out', description: "You have been successfully signed out." });
        router.push('/login');
    } catch (error) {
        toast({ title: 'Error', description: "Failed to sign out.", variant: 'destructive' });
    }
  };


  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    // onAuthStateChanged handles the redirect, this is a fallback.
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, handleLogout }}>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="flex h-14 items-center justify-center border-b px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Property Manager</h1>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild tooltip={item.label} isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-3 p-2 rounded-md transition-colors w-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.photoURL || "https://placehold.co/40x40.png"} alt="User Avatar" data-ai-hint="user avatar" />
                <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm overflow-hidden">
                <span className="font-semibold truncate">{user.displayName || 'User'}</span>
                <span className="text-muted-foreground truncate">{user.email}</span>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Log Out" onClick={handleLogout}>
                  <LogOut />
                  <span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
            <header className="sticky top-0 z-[1001] flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:justify-end">
                <SidebarTrigger className="md:hidden">
                    <PanelLeft />
                </SidebarTrigger>
            </header>
             <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthContext.Provider>
  )
}
