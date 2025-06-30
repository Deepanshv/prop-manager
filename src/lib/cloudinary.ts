
'use server';

const CLOUD_NAME = 'dud5wzuya';
const UPLOAD_PRESET = 'property_manager_unsigned';

export async function uploadToCloudinary(formData: FormData): Promise<string | null> {
  const file = formData.get('file') as File | null;
  if (!file) {
    console.error('Cloudinary upload error: No file found in FormData.');
    return null;
  }

  // Create a new FormData object for the server-side request.
  // This is safer than mutating the formData object received from the client.
  const serverFormData = new FormData();
  serverFormData.append('file', file);
  serverFormData.append('upload_preset', UPLOAD_PRESET);

  const fileType = file.type.split('/')[0];
  const resourceType = fileType === 'image' ? 'image' : 'raw';
  
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: serverFormData,
    });

    if (!response.ok) {
      // Gracefully handle non-JSON error responses from Cloudinary.
      // A common cause for this is an incorrect upload preset name.
      const errorText = await response.text();
      console.error(`Cloudinary upload failed with status ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('An unexpected error occurred during the Cloudinary upload:', error);
    return null;
  }
}
