"use client"

import { useState } from "react"
import { ImageCropperDialog } from "@/components/image-cropper-dialog"

export default function CropperProbePage() {
  const [file, setFile] = useState<File | null>(null)
  const [out, setOut] = useState<string | null>(null)

  return (
    <main className="p-8 flex flex-col gap-4">
      <input
        data-testid="probe-input"
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        data-testid="probe-sample"
        className="border px-3 py-1"
        onClick={async () => {
          const res = await fetch("/images/logo.jpg")
          const blob = await res.blob()
          setFile(new File([blob], "logo.jpg", { type: blob.type }))
        }}
      >
        sample
      </button>
      {out && <img data-testid="probe-out" src={out} alt="" className="w-40 h-40 object-cover border" />}
      <ImageCropperDialog
        file={file}
        onCancel={() => setFile(null)}
        onApply={(f) => {
          setOut(URL.createObjectURL(f))
          setFile(null)
        }}
      />
    </main>
  )
}
