'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  deleteUser,
  User,
} from 'firebase/auth'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import {
  Building2,
  Camera,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Settings,
  Users,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { auth, storage } from '@/lib/firebase'

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/properties", icon: Building2, label: "Properties" },
  { href: "#", icon: Users, label: "Prospects" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
})
type ProfileFormData = z.infer<typeof profileFormSchema>

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  })
type PasswordFormData = z.infer<typeof passwordFormSchema>

export default function SettingsPage() {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('')
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: '' },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  React.useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        profileForm.setValue('displayName', currentUser.displayName || '')
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [profileForm])

  const handleProfileUpdate = async (data: ProfileFormData) => {
    if (!user || !auth.currentUser) return
    try {
      await updateProfile(auth.currentUser, { displayName: data.displayName })
      // Manually update local user state to avoid waiting for onAuthStateChanged
      setUser({ ...user, displayName: data.displayName })
      toast({ title: 'Success', description: 'Profile updated successfully.' })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handlePasswordUpdate = async (data: PasswordFormData) => {
    if (!user || !user.email) return

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, data.newPassword)
      toast({ title: 'Success', description: 'Password changed successfully.' })
      passwordForm.reset()
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to change password. Please check your current password.', variant: 'destructive' })
    }
  }

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !auth.currentUser || !storage || !event.target.files || event.target.files.length === 0) return

    const file = event.target.files[0]
    const storageRef = ref(storage, `profile-pictures/${user.uid}`)

    try {
      await uploadBytes(storageRef, file)
      const photoURL = await getDownloadURL(storageRef)
      await updateProfile(auth.currentUser, { photoURL })
      // Manually update user state to reflect new photoURL immediately
      setUser({ ...user, photoURL })
      toast({ title: 'Success', description: 'Profile picture updated.' })
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to upload profile picture.', variant: 'destructive' })
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    try {
      await deleteUser(user)
      toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted.' })
      // The onAuthStateChanged listener will handle the user state change.
      // You may want to redirect the user to the login page here.
      setIsDeleteAlertOpen(false)
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to delete account. You may need to sign in again.', variant: 'destructive' })
    }
  }
  
  const PageSkeleton = () => (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Card>
        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
        <CardContent className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
       <Card>
        <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
        <CardContent>
             <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
    </div>
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Property-Manager</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild tooltip={item.label} isActive={item.href === '/settings'}>
                  <a href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-3 p-2 rounded-md transition-colors w-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || "https://placehold.co/40x40.png"} alt="User Avatar" data-ai-hint="user avatar" />
              <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-sm overflow-hidden">
              <span className="font-semibold truncate">{user?.displayName || 'User'}</span>
              <span className="text-muted-foreground truncate">{user?.email}</span>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Log Out">
                <LogOut />
                <span>Log Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:justify-end">
          <SidebarTrigger className="md:hidden">
            <PanelLeft />
          </SidebarTrigger>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {loading ? <PageSkeleton /> : !user ? (
            <div className="text-center text-muted-foreground">Please sign in to manage your settings.</div>
          ) : (
            <>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

                <div className="grid gap-6">
                    <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Update your display name and profile picture.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="h-20 w-20">
                            <AvatarImage src={user?.photoURL || "https://placehold.co/80x80.png"} alt="User Avatar" data-ai-hint="user avatar" />
                            <AvatarFallback className="text-2xl">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <Button size="icon" className="absolute bottom-0 right-0 rounded-full h-7 w-7" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="h-4 w-4" />
                            </Button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePictureChange} />
                        </div>
                        <div className="grid gap-1">
                            <p className="font-semibold text-lg">{user?.displayName || 'User'}</p>
                            <p className="text-muted-foreground">{user?.email}</p>
                        </div>
                        </div>
                        <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="mt-6 space-y-4 max-w-sm">
                            <FormField
                            control={profileForm.control}
                            name="displayName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Display Name</FormLabel>
                                <FormControl><Input placeholder="Your Name" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                                {profileForm.formState.isSubmitting ? 'Saving...' : 'Update Profile'}
                            </Button>
                        </form>
                        </Form>
                    </CardContent>
                    </Card>
                    
                    <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Choose a new password for your account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4 max-w-sm">
                            <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                {passwordForm.formState.isSubmitting ? 'Changing...' : 'Change Password'}
                            </Button>
                        </form>
                        </Form>
                    </CardContent>
                    </Card>

                    <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle>Danger Zone</CardTitle>
                        <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Delete Your Account</p>
                                <p className="text-sm text-muted-foreground">This will permanently delete your account and all associated data.</p>
                            </div>
                        <Button variant="destructive" onClick={() => setIsDeleteAlertOpen(true)}>Delete My Account</Button>
                        </div>
                    </CardContent>
                    </Card>
                </div>
            </>
          )}
        </main>
      </SidebarInset>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account. To confirm, please type your email address {'"'}<b>{user?.email}</b>{'"'} below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="your.email@example.com"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConfirmation !== user?.email}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
