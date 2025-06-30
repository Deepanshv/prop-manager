# Firebase Studio

This is a NextJS starter in Firebase Studio.

## IMPORTANT: Cloudinary Setup for File Uploads

For file and image uploads to work in this application, you **must** configure your Cloudinary account first. If you see an error like "Upload preset not found", it means the following steps have not been completed.

Please follow these instructions exactly in your Cloudinary dashboard:

1.  **Log in** to your [Cloudinary account](https://cloudinary.com/users/login).
2.  Go to **Settings** (the gear icon in the top right).
3.  Click on the **Upload** tab.
4.  Scroll down to the **Upload presets** section.
5.  Click **"Add upload preset"**.
6.  On the "Add upload preset" page, configure the following:
    *   **Upload preset name**: Enter `property_manager_unsigned` (must be this exact name, all lowercase).
    *   **Signing Mode**: Change from "Signed" to **"Unsigned"**. This is critical.
7.  Click **Save** at the top right.

After saving, uploads in the app will work correctly.

---

To get started with development, take a look at src/app/page.tsx.
