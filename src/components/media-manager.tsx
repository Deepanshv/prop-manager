
'use client'

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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { db } from '@/lib/firebase'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import {
  FileImage,
  Loader2,
  Trash2,
  UploadCloud,
  Video,
  View,
} from 'lucide-react'
import * as React from 'react'
import { Skeleton } from './ui/skeleton'
import { cn } from '@/lib/utils'

interface MediaManagerProps {
  entityType: 'properties' | 'prospects'
  entityId: string
}

interface MediaFile {
  id: string
  fileName: string
  url: string
  contentType: string
  sizeBytes: number
  uploadTimestamp: Timestamp
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

const MediaGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
    </div>
);

export function MediaManager({ entityType, entityId }: MediaManagerProps) {
  const [media, setMedia] = React.useState<MediaFile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [fileToDelete, setFileToDelete] = React.useState<MediaFile | null>(null)
  const { toast } = useToast()
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [viewingFile, setViewingFile] = React.useState<MediaFile | null>(null);
  const [isViewerLoading, setIsViewerLoading] = React.useState(true);

  React.useEffect(() => {
    if (!db || !entityId) {
        setMedia([])
        setLoading(false)
        return
    }

    setLoading(true)
    const mediaCollectionRef = collection(db, entityType, entityId, 'media')
    const q = query(mediaCollectionRef)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fileList = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as MediaFile)
        )
        setMedia(fileList)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching media files:', error)
        toast({ title: 'Error', description: 'Failed to fetch media.', variant: 'destructive' })
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [entityType, entityId, toast])

  const handleUpload = async (file: File) => {
    if (!db) {
      toast({ title: 'Error', description: 'Database not available.', variant: 'destructive' })
      return
    }
    setIsUploading(true);
    
    try {
        const result = await uploadToCloudinary(file);
        
        if (result.success && result.url) {
            const newFileRef = doc(collection(db, entityType, entityId, 'media'));
            await setDoc(newFileRef, {
              id: newFileRef.id,
              fileName: file.name,
              url: result.url,
              contentType: file.type,
              sizeBytes: file.size,
              uploadTimestamp: serverTimestamp(),
            });
            
            toast({ title: 'Success', description: `File uploaded successfully.` })
        } else {
            throw new Error(result.message || 'Upload to Cloudinary failed. Check console for details.');
        }
    } catch(error: any) {
        toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' })
    } finally {
      setIsUploading(false);
    }
  }

  const handleDeleteClick = (file: MediaFile) => {
    setFileToDelete(file)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!fileToDelete || !db) {
        toast({ title: 'Error', description: 'Could not delete file record.', variant: 'destructive' })
        return
    }
    const fileDocRef = doc(db, entityType, entityId, 'media', fileToDelete.id)

    try {
      await deleteDoc(fileDocRef)
      toast({ title: 'Success', description: `The file "${fileToDelete.fileName}" has been deleted.` })
    } catch (error) {
      console.error('Delete error:', error)
      toast({ title: 'Delete Failed', description: 'Could not delete the file.', variant: 'destructive' })
    } finally {
      setIsDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  const handleViewClick = (file: MediaFile) => {
    setIsViewerLoading(true);
    setViewingFile(file);
  }

  const handleUploadClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        handleUpload(file);
        event.target.value = '';
    }
  };
  

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Property Photos & Videos</CardTitle>
                <CardDescription>Upload and manage visual media for this property.</CardDescription>
            </div>
            <Button onClick={handleUploadClick} disabled={isUploading}>
                {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : "Upload Media"}
            </Button>
        </CardHeader>
        <CardContent>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,video/*" />
          {loading ? (
            <MediaGridSkeleton />
          ) : media.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {media.map((file) => (
                    <div key={file.id} className="relative group aspect-square">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent rounded-md" />
                        {file.contentType.startsWith('image/') ? (
                            <img src={file.url} alt={file.fileName} className="w-full h-full object-cover rounded-md" />
                        ) : (
                            <div className="w-full h-full bg-slate-800 rounded-md flex items-center justify-center">
                                <Video className="h-12 w-12 text-slate-500" />
                            </div>
                        )}
                        <div className="absolute bottom-2 left-2 text-white text-xs">
                           <p className="font-bold truncate max-w-28">{file.fileName}</p>
                           <p>{formatBytes(file.sizeBytes)}</p>
                        </div>
                        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-white/50" onClick={() => handleViewClick(file)}><View className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(file)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    </div>
                ))}
            </div>
          ) : (
            <div onClick={handleUploadClick} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <FileImage className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="font-semibold">No media uploaded yet</p>
                <p className="text-sm text-muted-foreground">Click here to upload the first photo or video.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingFile} onOpenChange={(open) => { if (!open) { setViewingFile(null); setIsViewerLoading(true); }}}>
        <DialogContent className="w-[90vw] h-[90vh] max-w-[90vw] flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 border-b flex-shrink-0">
                <DialogTitle>{viewingFile?.fileName || 'Media Viewer'}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full bg-muted/20 relative">
                {isViewerLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                {viewingFile && (
                  viewingFile.contentType.startsWith('image/') ? (
                    <img 
                        src={viewingFile.url} 
                        alt={viewingFile.fileName}
                        className={cn("w-full h-full object-contain transition-opacity duration-300", isViewerLoading && "opacity-0")} 
                        onLoad={() => setIsViewerLoading(false)}
                    />
                  ) : (
                    <video 
                        src={viewingFile.url} 
                        className={cn("w-full h-full transition-opacity duration-300", isViewerLoading && "opacity-0")} 
                        onLoadedData={() => setIsViewerLoading(false)}
                        controls
                        autoPlay
                    />
                  )
                )}
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the file {'"'}
              {fileToDelete?.fileName}{'"'}. This does not delete the file from Cloudinary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
