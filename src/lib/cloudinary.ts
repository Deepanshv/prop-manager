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
//    a. For "Upload preset name", enter EXACTLY: property_manager_uploads
//       (It must be all lowercase and spelled correctly).
//    b. For "Signing Mode", change it from "Signed" to "Unsigned". This is critical.
//
// 6. Click the "Save" button at the top right of the page.
//
// After saving, your application should be able to upload files without errors.
// ====================================================================================

const CLOUD_NAME = 'dud5wzuya'; // Your Cloudinary cloud name.
const UPLOAD_PRESET = 'property_manager_uploads'; // Must match the UNSIGNED preset you created.

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
      let errorMessage = 'An unexpected error occurred during upload.';
      try {
        const errorData = await response.json();
        console.error('Cloudinary Error Response:', errorData);
        // Safely access the nested error message.
        if (errorData && errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
            // Provide a more helpful message for the most common configuration error.
            if (errorMessage.includes('Upload preset') && errorMessage.includes('not found')) {
                errorMessage = `Upload preset "${UPLOAD_PRESET}" not found. Please follow the setup instructions in the README.md file to create it in your Cloudinary dashboard.`;
            }
        } else {
            // Provide a fallback message if the structure is not what we expect.
            errorMessage = `The server returned status ${response.status}. Please check your Cloudinary configuration, especially the upload preset name.`;
        }
      } catch (e) {
        // This catch block handles cases where response.json() fails (e.g., the response is not JSON).
        errorMessage = `The server returned a non-JSON error response (status ${response.status}).`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { success: true, url: data.secure_url };

  } catch (error: any) {
    console.error('Error during upload function:', error);
    // Returning structured error
    return { success: false, message: error.message || "An unknown error occurred during upload." };
  }
}
