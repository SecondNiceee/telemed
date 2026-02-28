"use client"

import { useState, useCallback } from "react"
import { DoctorsApi } from "@/lib/api/doctors"
import type { ApiDoctor } from "@/lib/api/types"
import { OrgPageHeader } from "@/components/lk-org/OrgPageHeader"
import { DoctorsListHeader } from "@/components/lk-org/DoctorsListHeader"
import { EmptyDoctorsList } from "@/components/lk-org/EmptyDoctorsList"
import { OrgDoctorCard } from "@/components/lk-org/OrgDoctorCard"
import { DeleteDoctorDialog } from "@/components/lk-org/DeleteDoctorDialog"

interface LkOrgContentProps {
  userName: string
  initialDoctors: ApiDoctor[]
  orgId: number
}

export function LkOrgContent({ userName, initialDoctors }: LkOrgContentProps) {
  const [deleteDoctor, setDeleteDoctor] = useState<ApiDoctor | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteRequest = useCallback((doctor: ApiDoctor) => {
    setDeleteDoctor(doctor)
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setDeleteDoctor(null)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDoctor) return
    setIsDeleting(true)
    try {
      await DoctorsApi.delete(deleteDoctor.id)
      setDeleteDoctor(null)
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить врача")
    } finally {
      setIsDeleting(false)
    }
  }, [deleteDoctor])

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrgPageHeader userName={userName} />

        <div className="flex flex-col gap-4">
          <DoctorsListHeader count={initialDoctors.length} />

          {initialDoctors.length === 0 ? (
            <EmptyDoctorsList />
          ) : (
            <div className="flex flex-col gap-3">
              {initialDoctors.map((doctor) => (
                <OrgDoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  onDeleteRequest={handleDeleteRequest}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DeleteDoctorDialog
        doctor={deleteDoctor}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
