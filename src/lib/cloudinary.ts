
'use server';

const CLOUD_NAME = 'dud5wzuya';
const UPLOAD_PRESET = 'property_manager_unsigned';

export async function uploadToCloudinary(formData: FormData): Promise<string | null> {
  formData.append('upload_preset', UPLOAD_PRESET);

  const file = formData.get('file') as File;
  if (!file) {
    console.error('Cloudinary upload error: No file found in FormData.');
    return null;
  }

  const fileType = file.type.split('/')[0];
  const resourceType = fileType === 'image' ? 'image' : 'raw';
  
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary upload failed:', errorData);
      return null;
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return null;
  }
}
