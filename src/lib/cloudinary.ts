
'use server';

// NOTE: This implementation requires a one-time setup in the Cloudinary dashboard:
// 1. Go to Settings > Upload.
// 2. Under Upload presets, click "Add upload preset".
// 3. Name the preset "property_manager_unsigned".
// 4. Change the "Signing Mode" to "Unsigned".
// 5. Click "Save".

const CLOUD_NAME = 'dud5wzuya';
const UPLOAD_PRESET = 'property_manager_unsigned';

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

  // Use the incoming FormData directly, and append the upload preset.
  // Creating a new FormData on the server breaks the file stream from the client.
  formData.append('upload_preset', UPLOAD_PRESET);

  const fileType = file.type.split('/')[0];
  const resourceType = fileType === 'image' ? 'image' : 'raw';
  
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
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
