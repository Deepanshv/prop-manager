
'use server';

const CLOUD_NAME = 'dud5wzuya';
const UPLOAD_PRESET = 'property_manager_uploads';

interface CloudinaryUploadResult {
    success: boolean;
    url?: string;
    message: string;
}

export async function uploadToCloudinary(formData: FormData): Promise<CloudinaryUploadResult> {
  const file = formData.get('file') as File | null;
  if (!file) {
    const message = 'Cloudinary upload error: No file found in FormData.';
    console.error(message);
    return { success: false, message };
  }

  // Append the upload preset directly to the incoming FormData object.
  // Do not create a new FormData object as it breaks the file stream.
  formData.append('upload_preset', UPLOAD_PRESET);

  const fileType = file.type.split('/')[0];
  const resourceType = fileType === 'image' ? 'image' : 'raw';
  
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData, // Use the original formData from the client
    });
    
    const data = await response.json();

    if (!response.ok) {
      const message = data.error?.message || 'Cloudinary upload failed. Please check server logs.';
      console.error(`Cloudinary upload failed with status ${response.status}:`, message);
      return { success: false, message };
    }

    if (!data.secure_url) {
      const message = 'Cloudinary upload succeeded but did not return a secure URL.';
      console.error(message, data);
      return { success: false, message };
    }

    return { success: true, url: data.secure_url, message: 'File uploaded successfully.' };
  } catch (error) {
    const message = 'An unexpected error occurred during the Cloudinary upload.';
    console.error(message, error);
    return { success: false, message };
  }
}
