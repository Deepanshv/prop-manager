
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { auth, db, storage } from '@/lib/firebase'
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
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage'
import { User } from 'firebase/auth'
import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  MoreVertical,
  Trash2,
  Upload,
  View,
} from 'lucide-react'
import * as React from 'react'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Skeleton } from './ui/skeleton'
import { useAuth } from '../app/(app)/layout'

interface FileManagerProps {
  entityType: 'properties' | 'prospects'
  entityId: string
}

interface FileMetadata {
  id: string
  fileName: string
  storagePath: string
  contentType: string
  sizeBytes: number
  uploadTimestamp: Timestamp
}

const getFileIcon = (contentType: string) => {
  if (contentType.startsWith('image/')) return <FileImage className="h-5 w-5" />
  if (contentType.startsWith('video/')) return <FileVideo className="h-5 w-5" />
  if (contentType.startsWith('audio/')) return <FileAudio className="h-5 w-5" />
  if (contentType.startsWith('text/')) return <FileText className="h-5 w-5" />
  if (contentType.includes('zip') || contentType.includes('archive'))
    return <FileArchive className="h-5 w-5" />
  return <FileIcon className="h-5 w-5" />
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function FileManager({ entityType, entityId }: FileManagerProps) {
  const { user } = useAuth()
  const [files, setFiles] = React.useState<FileMetadata[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [fileToDelete, setFileToDelete] = React.useState<FileMetadata | null>(null)
  const [uploadingFile, setUploadingFile] = React.useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const { toast } = useToast()

  React.useEffect(() => {
    if (!db || !entityId) {
        setFiles([])
        setLoading(false)
        return
    }

    setLoading(true)
    const filesCollectionRef = collection(db, entityType, entityId, 'files')
    const q = query(filesCollectionRef)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fileList = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as FileMetadata)
        )
        setFiles(fileList)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching files:', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch files.',
          variant: 'destructive',
        })
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [entityType, entityId, toast])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      handleUpload(file)
    }
  }

  const handleUpload = (file: File) => {
    if (!user || !storage) {
      toast({ title: 'Error', description: 'Cannot upload file.', variant: 'destructive' })
      return
    }
    setUploadingFile(file)
    setUploadProgress(0)
    setIsUploadDialogOpen(true)

    const storagePath = `users/${user.uid}/${entityType}/${entityId}/documents/${file.name}`
    const storageRef = ref(storage, storagePath)
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        setUploadProgress(progress)
      },
      (error) => {
        console.error('Upload error:', error)
        toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' })
        setUploadingFile(null)
      },
      async () => {
        if (!db) return;
        const fileDocRef = doc(db, entityType, entityId, 'files', file.name)

        await setDoc(fileDocRef, {
          fileName: file.name,
          storagePath: storagePath,
          contentType: file.type,
          sizeBytes: file.size,
          uploadTimestamp: serverTimestamp(),
        })

        toast({ title: 'Success', description: 'File uploaded successfully.' })
        setUploadingFile(null)
        setUploadProgress(0)
        setIsUploadDialogOpen(false)
      }
    )
  }

  const handleDeleteClick = (file: FileMetadata) => {
    setFileToDelete(file)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!fileToDelete || !storage || !db) {
        toast({ title: 'Error', description: 'Could not delete file.', variant: 'destructive' })
        return
    }

    const fileStorageRef = ref(storage, fileToDelete.storagePath)
    const fileDocRef = doc(db, entityType, entityId, 'files', fileToDelete.id)

    try {
      await deleteObject(fileStorageRef)
      await deleteDoc(fileDocRef)
      toast({ title: 'Success', description: 'File deleted successfully.' })
    } catch (error) {
      console.error('Delete error:', error)
      toast({ title: 'Delete Failed', description: 'Could not delete the file.', variant: 'destructive' })
    } finally {
      setIsDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  const handleViewClick = async (file: FileMetadata) => {
    if (!storage) return;
    try {
      const url = await getDownloadURL(ref(storage, file.storagePath))
      window.open(url, '_blank')
    } catch (error) {
        console.error('Error getting download URL:', error)
        toast({ title: 'Error', description: 'Could not get file URL.', variant: 'destructive' })
    }
  }

  const TableSkeleton = () => (
    <>
      {[...Array(3)].map((_, i) => (
        <TableRow key={i}>
          <TableCell className='flex items-center gap-2'>
            <Skeleton className="h-5 w-5" /> <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  )

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Associated Files</CardTitle>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload File
            </Button>
            <Input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : files.length > 0 ? (
                files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {getFileIcon(file.contentType)}
                      {file.fileName}
                    </TableCell>
                    <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
                    <TableCell>
                      {file.uploadTimestamp
                        ? format(file.uploadTimestamp.toDate(), 'PPP')
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewClick(file)}>
                            <View className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(file)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No files have been uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uploading File</DialogTitle>
          </DialogHeader>
          {uploadingFile && (
            <div className='space-y-2'>
                <p className='text-sm text-muted-foreground'>Uploading: {uploadingFile.name}</p>
                <Progress value={uploadProgress} />
                <p className='text-xs text-center'>{Math.round(uploadProgress)}%</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the file {'"'}
              {fileToDelete?.fileName}{'"'} from storage.
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
