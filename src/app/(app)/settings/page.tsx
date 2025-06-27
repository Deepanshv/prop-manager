
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  deleteUser,
  User,
} from 'firebase/auth'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  Camera,
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
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { auth, db, storage } from '@/lib/firebase'
import { useAuth } from '../layout'

const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  primaryNumber: z.string().regex(/^\d{10}$/, { message: "Must be a 10-digit number."}).optional().or(z.literal('')),
  secondaryNumber: z.string().regex(/^\d{10}$/, { message: "Must be a 10-digit number."}).optional().or(z.literal('')),
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
  const { user: authUser, handleLogout } = useAuth()
  const [user, setUser] = React.useState<User>(authUser)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('')
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isProfileLoading, setIsProfileLoading] = React.useState(true);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      primaryNumber: '',
      secondaryNumber: '',
    },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  
  React.useEffect(() => {
    setUser(authUser)
    if (authUser && db) {
      setIsProfileLoading(true);
      const fetchProfile = async () => {
        try {
          const userDocRef = doc(db, 'users', authUser.uid);
          const docSnap = await getDoc(userDocRef);
          let primaryNumber = '';
          let secondaryNumber = '';
          if (docSnap.exists()) {
            const data = docSnap.data();
            primaryNumber = data.primaryNumber || '';
            secondaryNumber = data.secondaryNumber || '';
          }
          profileForm.reset({
            displayName: authUser.displayName || '',
            primaryNumber,
            secondaryNumber,
          });
        } catch (error) {
          toast({ title: 'Error', description: 'Could not fetch profile data.', variant: 'destructive' });
           profileForm.reset({
            displayName: authUser.displayName || '',
            primaryNumber: '',
            secondaryNumber: '',
          });
        } finally {
          setIsProfileLoading(false);
        }
      };
      fetchProfile();
    }
  }, [authUser, db, profileForm, toast])

  const handleProfileUpdate = async (data: ProfileFormData) => {
    if (!auth.currentUser || !db) return
    try {
      await updateProfile(auth.currentUser, { displayName: data.displayName })
      setUser(prevUser => ({ ...prevUser, displayName: data.displayName } as User))

      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { 
        primaryNumber: data.primaryNumber,
        secondaryNumber: data.secondaryNumber,
        email: auth.currentUser.email,
        displayName: data.displayName
      }, { merge: true });

      toast({ title: 'Success', description: 'Profile updated successfully.' })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handlePasswordUpdate = async (data: PasswordFormData) => {
    if (!user.email) return

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
    if (!auth.currentUser || !storage || !event.target.files || event.target.files.length === 0) return

    const file = event.target.files[0]
    const storageRef = ref(storage, `users/${user.uid}/profile-picture/${file.name}`)

    try {
      await uploadBytes(storageRef, file)
      const photoURL = await getDownloadURL(storageRef)
      await updateProfile(auth.currentUser, { photoURL })
      setUser(prevUser => ({ ...prevUser, photoURL } as User))
      toast({ title: 'Success', description: 'Profile picture updated.' })
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to upload profile picture.', variant: 'destructive' })
    }
  }

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return
    try {
      await deleteUser(auth.currentUser)
      toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted.' })
      handleLogout();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to delete account. You may need to sign in again.', variant: 'destructive' })
    } finally {
        setIsDeleteAlertOpen(false)
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
            <div className="max-w-sm space-y-4 pt-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32 mt-4" />
            </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
         <CardContent className="space-y-4 max-w-sm">
             <Skeleton className="h-4 w-24" />
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-4 w-24" />
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-4 w-24" />
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-32 mt-4" />
         </CardContent>
      </Card>
    </div>
  )

  if (!user) {
    return <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6"><PageSkeleton /></main>;
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <div className="grid gap-6">
            <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your display name and contact information.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4">
                <div className="relative">
                    <Avatar className="h-20 w-20">
                    <AvatarImage src={user.photoURL || "https://placehold.co/80x80.png"} alt="User Avatar" data-ai-hint="user avatar"/>
                    <AvatarFallback className="text-2xl">{user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <Button size="icon" className="absolute bottom-0 right-0 rounded-full h-7 w-7" onClick={() => fileInputRef.current?.click()}>
                        <Camera className="h-4 w-4" />
                    </Button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePictureChange} />
                </div>
                </div>
                {isProfileLoading ? (
                  <div className="mt-6 space-y-4 max-w-sm">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="mt-6 space-y-4 max-w-sm">
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <Input readOnly disabled value={user.email || 'No email associated'} />
                    </FormItem>
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
                    <FormField
                    control={profileForm.control}
                    name="primaryNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Primary Number</FormLabel>
                        <FormControl><Input placeholder="10-digit mobile number" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                    control={profileForm.control}
                    name="secondaryNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Secondary Number (Optional)</FormLabel>
                        <FormControl><Input placeholder="10-digit mobile number" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                        {profileForm.formState.isSubmitting ? 'Saving...' : 'Update Profile'}
                    </Button>
                </form>
                </Form>
                )}
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
      </main>
      
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
            placeholder={user.email || "your.email@example.in"}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConfirmation !== user.email}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
