import re
import os

filepath = 'functions/api/[[path]].ts'
with open(filepath, 'r') as f:
    content = f.read()

avatar_upload_endpoint = """
    // Avatar upload handler for Cloudflare Workers
    if (path === "/api/avatars/upload" && method === "POST") {
      try {
        const contentType = request.headers.get("content-type") || "";
        let fileBase64 = "";
        let filename = "";
        let userId = "";

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          userId = formData.get("userId") as string || "";
          filename = formData.get("filename") as string || "";
          
          if (formData.has("base64")) {
            fileBase64 = formData.get("base64") as string;
          } else if (formData.has("avatar")) {
            const file = formData.get("avatar") as File;
            const arrayBuffer = await file.arrayBuffer();
            // Convert ArrayBuffer to Base64
            let binary = '';
            const bytes = new Uint8Array(arrayBuffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            fileBase64 = btoa(binary);
          }
        } else {
          const body = await request.json() as any;
          fileBase64 = body.base64;
          filename = body.filename;
          userId = body.userId;
        }

        if (!fileBase64) {
          return buildResponse({ error: "Missing avatar file data (base64 or file required)." }, 400);
        }

        const safeFilename = filename || `avatar_${userId || 'user'}_${Date.now()}.png`;

        // Upload to R2 Bucket
        if (env.R2_BUCKET) {
          try {
            const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, "");
            const binaryString = atob(cleanBase64);
            const buffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              buffer[i] = binaryString.charCodeAt(i);
            }
            await env.R2_BUCKET.put(safeFilename, buffer, {
              httpMetadata: { contentType: "image/png" },
            });
            console.log(`[R2] Successfully uploaded avatar ${safeFilename} to bucket.`);
          } catch (r2Err) {
            console.error(`[R2 ERROR] Failed to upload avatar to bucket:`, r2Err);
          }
        }
        
        // Also sync to Firestore for fallback/local emulation via server.ts
        if (apiKey && projectId) {
           try {
              const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, "");
              const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/uploaded_files/${encodeURIComponent(safeFilename)}?key=${apiKey}`;
              await fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fields: {
                    base64: { stringValue: cleanBase64 },
                    timestamp: { stringValue: new Date().toISOString() }
                  }
                })
              });
           } catch(e) {
              console.warn("Failed syncing avatar to firestore", e);
           }
        }

        const previewUrl = `/api/documents/preview/${encodeURIComponent(safeFilename)}`;
        
        // If userId is provided, update user in database if found
        if (userId) {
          const db = await dbManager.loadDB();
          let userFound = false;
          
          if (db.admins) {
            const admin = db.admins.find((a: any) => a.id === userId || a.email === userId);
            if (admin) {
              admin.avatar_url = previewUrl;
              userFound = true;
            }
          }
          if (!userFound && db.drivers) {
            const driver = db.drivers.find((d: any) => d.id === userId || d.driver_id === userId);
            if (driver) {
              driver.avatar_url = previewUrl;
              userFound = true;
            }
          }
          if (!userFound && db.shareholders) {
            const sh = db.shareholders.find((s: any) => s.id === userId || s.shareholder_id === userId);
            if (sh) {
              sh.avatar_url = previewUrl;
              userFound = true;
            }
          }
          if (!userFound && db.users) {
            const usr = db.users.find((u: any) => u.id === userId);
            if (usr) {
               usr.avatar = previewUrl;
               usr.passport_photo_url = previewUrl;
               userFound = true;
            }
          }
          if (userFound) {
            await dbManager.saveDB(db);
          }
        }

        return buildResponse({
          success: true,
          filename: safeFilename,
          url: previewUrl,
          message: "Avatar uploaded successfully."
        });

      } catch (err: any) {
        console.error("Avatar upload error:", err);
        return buildResponse({ error: err.message || "Failed to upload avatar" }, 500);
      }
    }
"""

content = content.replace('    if (path === "/api/auth/register-director" && method === "POST") {', avatar_upload_endpoint + '\n    if (path === "/api/auth/register-director" && method === "POST") {')

with open(filepath, 'w') as f:
    f.write(content)
print("Injected avatar upload endpoint")
