
'use client';

// ====================================================================================
// !! IMPORTANT !! CLOUDINARY SETUP INSTRUCTIONS
// ====================================================================================
// The "preset not found" error means this setup is not complete or is incorrect.
// Please follow these steps exactly in your Cloudinary dashboard:
//
// 1. Log in to your Cloudinary account.
// 2. Go to "Settings" (the gear icon in the top right).
// 3. Click on the "Upload" tab.
// 4. Scroll down to the "Upload presets" section and click "Add upload preset".
//
// 5. On the "Add upload preset" page:
//    a. For "Upload preset name", enter EXACTLY: property_manager_unsigned
//       (It must be all lowercase and spelled correctly).
//    b. For "Signing Mode", change it from "Signed" to "Unsigned". This is critical.
//
// 6. Click the "Save" button at the top right of the page.
//
// After saving, your application should be able to upload files without errors.
// ====================================================================================

const CLOUD_NAME = 'dud5wzuya'; // Your Cloudinary cloud name.
const UPLOAD_PRESET = 'property_manager_unsigned'; // Must match the UNSIGNED preset you created.

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
