
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
  CheckCircle,
  Circle,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  View,
} from 'lucide-react'
import * as React from 'react'
import { Skeleton } from './ui/skeleton'

interface FileManagerProps {
  entityType: 'properties' | 'prospects'
  entityId: string
}

interface FileMetadata {
  id: string
  documentType: string
  fileName: string
  url: string
  contentType: string
  sizeBytes: number
  uploadTimestamp: Timestamp
}

const requiredDocs = [
  { id: 'registry-document', name: 'Registry Document' },
  { id: 'land-book', name: 'Land Book (Bhu Pustika) Document' },
  { id: 'owner-aadhaar-card', name: 'Owner\'s Aadhaar Card' },
  { id: 'owner-pan-card', name: 'Owner\'s PAN Card' },
];

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

const DocumentSkeleton = () => (
    <div className="space-y-2 rounded-md border">
        {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b last:border-b-0 animate-pulse">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
                <Skeleton className="h-9 w-24 rounded-md" />
            </div>
        ))}
    </div>
);


export function FileManager({ entityType, entityId }: FileManagerProps) {
  const [files, setFiles] = React.useState<FileMetadata[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [fileToDelete, setFileToDelete] = React.useState<FileMetadata | null>(null)
  const { toast } = useToast()
  
  const [selectedDocTypeId, setSelectedDocTypeId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [viewingFileUrl, setViewingFileUrl] = React.useState<string | null>(null);


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

  const handleUpload = async (file: File, docTypeId: string) => {
    if (!db) {
      toast({ title: 'Error', description: 'Database not available.', variant: 'destructive' })
      return
    }
    setIsUploading(true);
    
    const docTypeName = requiredDocs.find(d => d.id === docTypeId)?.name || 'Untitled Document';
    const isUpdating = files.some(f => f.id === docTypeId);

    try {
        const secureUrl = await uploadToCloudinary(file);
        
        if (secureUrl) {
            const fileDocRef = doc(db, entityType, entityId, 'files', docTypeId);
            await setDoc(fileDocRef, {
              id: docTypeId,
              documentType: docTypeName,
              fileName: file.name,
              url: secureUrl,
              contentType: file.type,
              sizeBytes: file.size,
              uploadTimestamp: serverTimestamp(),
            }, { merge: true });
            
            toast({ title: 'Success', description: `${docTypeName} ${isUpdating ? 'updated' : 'uploaded'} successfully.` })
        } else {
            throw new Error('Upload to Cloudinary failed. Check console for details.');
        }
    } catch(error: any) {
        toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' })
    } finally {
      setIsUploading(false);
      setSelectedDocTypeId(null);
    }
  }

  const handleDeleteClick = (file: FileMetadata) => {
    setFileToDelete(file)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!fileToDelete || !db) {
        toast({ title: 'Error', description: 'Could not delete file record.', variant: 'destructive' })
        return
    }
    const fileDocRef = doc(db, entityType, entityId, 'files', fileToDelete.id)

    try {
      await deleteDoc(fileDocRef)
      toast({ title: 'Success', description: `The file record for "${fileToDelete.documentType}" has been deleted.` })
    } catch (error) {
      console.error('Delete error:', error)
      toast({ title: 'Delete Failed', description: 'Could not delete the file record.', variant: 'destructive' })
    } finally {
      setIsDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  const handleViewClick = (file: FileMetadata) => {
    setViewingFileUrl(file.url)
  }

  const handleUploadClick = (docTypeId: string) => {
    if (isUploading) return;
    setSelectedDocTypeId(docTypeId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedDocTypeId) {
        handleUpload(file, selectedDocTypeId);
        event.target.value = '';
    }
  };
  
  const filesMap = React.useMemo(() => 
    new Map(files.map(file => [file.id, file])),
    [files]
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Document Manager</CardTitle>
          <CardDescription>Upload and manage required documents for this property. Each document type can only be uploaded once.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
          {loading ? (
            <DocumentSkeleton />
          ) : (
            <div className="space-y-2 rounded-md border">
              {requiredDocs.map((docType) => {
                const file = filesMap.get(docType.id);
                const isUploadingThisDoc = isUploading && selectedDocTypeId === docType.id;

                return (
                  <div key={docType.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {file ? (
                         <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                         <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-grow overflow-hidden">
                        <p className="font-medium">{docType.name}</p>
                        {file && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">{file.fileName} - {formatBytes(file.sizeBytes)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {file ? (
                        <div className="flex items-center gap-2">
                           <Button variant="outline" size="sm" onClick={() => handleViewClick(file)}><View className="h-4 w-4 mr-2" />View</Button>
                           <Button variant="outline" size="sm" onClick={() => handleUploadClick(docType.id)} disabled={isUploading}>
                                {isUploadingThisDoc ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4 mr-2" />}
                                {isUploadingThisDoc ? 'Updating...' : 'Update'}
                           </Button>
                           <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(file)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                        </div>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => handleUploadClick(docType.id)} disabled={isUploading}>
                          {isUploadingThisDoc ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                          ) : (
                            <Upload className="mr-2 h-4 w-4"/>
                          )}
                          {isUploadingThisDoc ? "Uploading..." : "Upload"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingFileUrl} onOpenChange={(open) => !open && setViewingFileUrl(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 border-b flex-shrink-0">
                <DialogTitle>Document Viewer</DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full bg-muted/20">
                {viewingFileUrl && (
                    <iframe src={viewingFileUrl} className="w-full h-full border-0" title="Document Viewer" />
                )}
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the file record for {'"'}
              {fileToDelete?.documentType}{'"'}. This does not delete the file from Cloudinary.
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
