
'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicListingsContent } from '@/components/public-listings-content';

const PageSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
            <Card key={i} className="flex flex-col overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4 space-y-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex justify-between items-center border-t pt-4">
                         <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-24" />
                         </div>
                        <Skeleton className="h-10 w-32" />
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

// This is now a Server Component that wraps the client part in Suspense.
export default function PublicListingsPage() {
    return (
        <React.Suspense fallback={
          <div className="bg-background min-h-screen">
             <header className="bg-card border-b sticky top-0 z-10">
                <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
                  <Skeleton className="h-8 w-48" />
                </div>
              </header>
              <main className="container mx-auto p-4 lg:p-6 space-y-6">
                <div className="flex-grow">
                  <Skeleton className="h-9 w-72" />
                </div>
                <PageSkeleton />
              </main>
          </div>
        }>
            <PublicListingsContent />
        </React.Suspense>
    );
}
