import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  try {
    return await requireAuthenticatedUser(token);
  } catch {
    return null;
  }
}

/** POST /api/messages/upload — upload a chat attachment to Supabase Storage */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "messages.send")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ message: "No file provided" }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ message: "File too large (max 10 MB)" }, { status: 413 });
  }

  const originalName = file instanceof File ? file.name : "attachment";
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "bin";
  const timestamp = Date.now();
  const path = `${auth.user.id}/${timestamp}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    console.error("[POST /api/messages/upload]", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("chat-attachments")
    .getPublicUrl(path);

  // Detect attachment type
  const mimeType = file.type || "";
  let attachmentType: "image" | "file" = "file";
  if (mimeType.startsWith("image/")) attachmentType = "image";

  return NextResponse.json({
    url: urlData.publicUrl,
    name: originalName,
    size: file.size,
    type: attachmentType,
    mime: mimeType,
  });
}
