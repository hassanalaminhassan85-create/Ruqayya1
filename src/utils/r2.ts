/**
 * Cloudflare R2 Avatar Storage Utility
 * Handles multipart file uploads and consistent mapping for user avatars,
 * integrating with Cloudflare R2 and Firestore persistent storage backup.
 */

export interface AvatarUploadResponse {
  success: boolean;
  url: string;
  filename: string;
  error?: string;
}

/**
 * Uploads a user avatar file (Blob, File, or base64) to the R2 bucket via the secure backend API route
 * which signs requests with CLOUDFLARE_API_TOKEN and backs up to Firestore.
 */
export async function uploadUserAvatar(fileOrBase64: File | Blob | string, userId: string, filename?: string): Promise<AvatarUploadResponse> {
  try {
    let formData = new FormData();
    if (typeof fileOrBase64 === 'string') {
      // Base64 string
      formData.append('base64', fileOrBase64);
      formData.append('filename', filename || `avatar_${userId}_${Date.now()}.png`);
    } else {
      formData.append('avatar', fileOrBase64, filename || `avatar_${userId}_${Date.now()}.png`);
    }
    formData.append('userId', userId);

    const response = await fetch('/api/avatars/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Failed to upload avatar to R2 storage');
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url || `/api/documents/preview/${data.filename}`,
      filename: data.filename,
    };
  } catch (error: any) {
    console.error('R2 Avatar Upload Error:', error);
    return {
      success: false,
      url: '',
      filename: '',
      error: error.message || 'Unknown upload error',
    };
  }
}

/**
 * Resolves an avatar URL, ensuring it checks R2 storage / document preview endpoint
 * and falls back gracefully to local assets or initials if needed.
 */
export function getAvatarUrl(avatarPath?: string | null, defaultAsset: string = '/logo.png'): string {
  if (!avatarPath) return defaultAsset;
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://') || avatarPath.startsWith('data:')) {
    return avatarPath;
  }
  if (avatarPath.startsWith('/api/')) {
    return avatarPath;
  }
  // If it's a stored filename in R2/Firestore
  return `/api/documents/preview/${encodeURIComponent(avatarPath)}`;
}
