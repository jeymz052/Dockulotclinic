"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { FaCamera, FaCloudArrowUp, FaXmark, FaCheck, FaTrash, FaPlus, FaRotate } from "react-icons/fa6";

export type ExistingPhotoToReplace = {
  id: string;
  stage: "pre_procedure" | "post_procedure";
  fileName: string;
  fileUrl: string;
};

type PhotoUploadModalProps = {
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  accessToken: string | null;
  initialReplacePhoto?: ExistingPhotoToReplace | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function PatientPhotoUploadModal({
  patientId,
  patientName,
  appointmentId,
  accessToken,
  initialReplacePhoto,
  onClose,
  onSuccess,
}: PhotoUploadModalProps) {
  const preInputRef = useRef<HTMLInputElement | null>(null);
  const postInputRef = useRef<HTMLInputElement | null>(null);

  const [preFile, setPreFile] = useState<File | null>(null);
  const [prePreview, setPrePreview] = useState<string | null>(null);

  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState<string | null>(null);

  const [beforeNotes, setBeforeNotes] = useState("");
  const [afterNotes, setAfterNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If opening in replace mode
  const isReplacing = Boolean(initialReplacePhoto);

  function handlePreFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setError(null);
    setPreFile(file);
    setPrePreview(URL.createObjectURL(file));
  }

  function handlePostFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setError(null);
    setPostFile(file);
    setPostPreview(URL.createObjectURL(file));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!preFile && !postFile) {
      setError("Please select at least one photo.");
      return;
    }
    if (!accessToken) {
      setError("Session expired. Please log in again.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadPromises: Promise<Response>[] = [];

      if (preFile) {
        const formData = new FormData();
        formData.append("file", preFile);
        formData.append("patient_id", patientId);
        if (appointmentId) formData.append("appointment_id", appointmentId);
        formData.append("stage", "pre_procedure");
        formData.append("notes", beforeNotes);
        if (initialReplacePhoto && initialReplacePhoto.stage === "pre_procedure") {
          formData.append("replace_file_id", initialReplacePhoto.id);
        }

        uploadPromises.push(
          fetch("/api/v2/patient-photos", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          })
        );
      }

      if (postFile) {
        const formData = new FormData();
        formData.append("file", postFile);
        formData.append("patient_id", patientId);
        if (appointmentId) formData.append("appointment_id", appointmentId);
        formData.append("stage", "post_procedure");
        formData.append("notes", afterNotes);
        if (initialReplacePhoto && initialReplacePhoto.stage === "post_procedure") {
          formData.append("replace_file_id", initialReplacePhoto.id);
        }

        uploadPromises.push(
          fetch("/api/v2/patient-photos", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          })
        );
      }

      const results = await Promise.all(uploadPromises);
      for (const res of results) {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || "Failed to upload one or more photos.");
        }
      }

      if (isReplacing) {
        onSuccess("Procedure photo replaced successfully!");
      } else {
        const count = (preFile ? 1 : 0) + (postFile ? 1 : 0);
        onSuccess(`Successfully attached ${count} procedure photo(s) to patient EHR!`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
              {isReplacing ? "Replace Procedure Photo" : "EHR Procedure Documentation"}
            </span>
            <h3 className="text-lg font-black text-neutral-900">
              {isReplacing ? `Replace ${initialReplacePhoto?.stage === "pre_procedure" ? "Before" : "After"} Photo` : "Before & After Procedure Photos"}
            </h3>
            <p className="text-xs text-neutral-500">For patient: <strong className="text-neutral-700">{patientName}</strong></p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <FaXmark className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {isReplacing && initialReplacePhoto && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-3">
              <FaRotate className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <strong>Replacing current image:</strong> {initialReplacePhoto.fileName}
                <div className="text-[11px] text-amber-700 mt-0.5">Uploading the new file below will automatically substitute this photo in the patient's record.</div>
              </div>
            </div>
          )}

          {/* Dual Slot: Pre-Procedure (Before) & Post-Procedure (After) */}
          <div className={`grid gap-4 ${isReplacing ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {/* PRE-PROCEDURE / BEFORE */}
            {(!isReplacing || initialReplacePhoto?.stage === "pre_procedure") && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-xs font-black uppercase text-teal-800">
                      📸 {isReplacing ? "New Replacement Photo" : "1. Pre-Procedure (Before)"}
                    </span>
                    {preFile && (
                      <button
                        type="button"
                        onClick={() => { setPreFile(null); setPrePreview(null); }}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    ref={preInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePreFile(e.target.files?.[0] || null)}
                  />

                  {prePreview ? (
                    <div className="relative mt-2 h-44 w-full overflow-hidden rounded-lg border border-teal-200 bg-black/5">
                      <Image src={prePreview} alt="Before preview" fill className="object-contain" />
                    </div>
                  ) : (
                    <div
                      onClick={() => preInputRef.current?.click()}
                      className="mt-2 flex h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-teal-300 bg-white p-4 text-center transition hover:bg-teal-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                        <FaCamera className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-bold text-teal-950">
                        {isReplacing ? "Choose New Replacement Photo" : "Attach BEFORE Photo"}
                      </p>
                      <p className="text-[10px] text-teal-600 mt-0.5">Click to select pre-procedure photo</p>
                    </div>
                  )}

                  {/* Separate Note for Before Photo */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-teal-900 mb-1">
                      Pre-Procedure / Before Notes
                    </label>
                    <textarea
                      rows={2}
                      value={beforeNotes}
                      onChange={(e) => setBeforeNotes(e.target.value)}
                      placeholder="e.g. Skin baseline before treatment, target area, patient concerns..."
                      className="w-full rounded-lg border border-teal-200 bg-white p-2 text-xs text-neutral-800 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* POST-PROCEDURE / AFTER */}
            {(!isReplacing || initialReplacePhoto?.stage === "post_procedure") && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-black uppercase text-emerald-800">
                      ✨ {isReplacing ? "New Replacement Photo" : "2. Post-Procedure (After)"}
                    </span>
                    {postFile && (
                      <button
                        type="button"
                        onClick={() => { setPostFile(null); setPostPreview(null); }}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    ref={postInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePostFile(e.target.files?.[0] || null)}
                  />

                  {postPreview ? (
                    <div className="relative mt-2 h-44 w-full overflow-hidden rounded-lg border border-emerald-200 bg-black/5">
                      <Image src={postPreview} alt="After preview" fill className="object-contain" />
                    </div>
                  ) : (
                    <div
                      onClick={() => postInputRef.current?.click()}
                      className="mt-2 flex h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 bg-white p-4 text-center transition hover:bg-emerald-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <FaPlus className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-bold text-emerald-950">
                        {isReplacing ? "Choose New Replacement Photo" : "Attach AFTER Photo"}
                      </p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Click to select post-procedure photo</p>
                    </div>
                  )}

                  {/* Separate Note for After Photo */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                      Post-Procedure / After Notes
                    </label>
                    <textarea
                      rows={2}
                      value={afterNotes}
                      onChange={(e) => setAfterNotes(e.target.value)}
                      placeholder="e.g. Immediate post-op response, erythema normal, aftercare instructions..."
                      className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-neutral-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
            <p className="text-xs text-neutral-500">
              {preFile && postFile ? "Both Before and After photos ready." : preFile ? "Before photo ready." : postFile ? "After photo ready." : "Select photo(s) to attach."}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || (!preFile && !postFile)}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-5 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                <FaCloudArrowUp className="h-3.5 w-3.5" />
                {isUploading ? "Uploading..." : isReplacing ? "Replace Photo" : "Save to EHR"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
