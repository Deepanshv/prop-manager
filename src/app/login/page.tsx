
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { Building2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { auth } from '@/lib/firebase'

const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type LoginFormData = z.infer<typeof loginFormSchema>

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true);

  // Redirect authenticated users away from the login page
  React.useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/') // Redirect to dashboard if logged in
      } else {
        setLoading(false);
      }
    })
    return () => unsubscribe()
  }, [router])

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginFormData) => {
    if (!auth) {
        toast({ title: 'Error', description: 'Firebase not configured.', variant: 'destructive' })
        return
    }
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password)
      toast({ title: 'Success', description: 'Welcome back!' })
      router.push('/')
    } catch (error) {
      toast({
        title: 'Sign In Failed',
        description: 'Invalid credentials, please try again.',
        variant: 'destructive',
      })
    }
  }
  
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center space-y-6">
        <div className="flex items-center gap-2 text-2xl font-semibold">
           <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
             <Building2 className="h-6 w-6" />
           </div>
           <h1>Property-Manager</h1>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <p className="px-8 text-center text-sm text-muted-foreground">
          Access is by invitation only. Please contact an administrator if you need access.
        </p>
      </div>
    </main>
  )
}
