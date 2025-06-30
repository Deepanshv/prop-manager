
'use client';

// NOTE: This implementation requires a one-time setup in the Cloudinary dashboard:
// 1. Go to Settings > Upload.
// 2. Under Upload presets, click "Add upload preset".
// 3. Name the preset "property_manager_unsigned".
// 4. Change the "Signing Mode" to "Unsigned".
// 5. Click "Save".

const CLOUD_NAME = 'dud5wzuya';
const UPLOAD_PRESET = 'property_manager_unsigned'; // Must be an UN-signed preset

export async function uploadToCloudinary(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // This will give us a more detailed error from Cloudinary
      const errorData = await response.json();
      console.error('Cloudinary Error Response:', errorData);
      throw new Error(`Upload failed: ${errorData.error.message}`);
    }

    const data = await response.json();
    return { success: true, url: data.secure_url };

  } catch (error: any) {
    console.error('Error during upload function:', error);
    // Returning structured error
    return { success: false, message: error.message || "An unknown error occurred during upload." };
  }
}
