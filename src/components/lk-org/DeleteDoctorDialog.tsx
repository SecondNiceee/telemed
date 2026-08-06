"use client"

import { memo } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ApiDoctor } from "@/lib/api/types"

interface DeleteDoctorDialogProps {
  doctor: ApiDoctor | null
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const DeleteDoctorDialog = memo(function DeleteDoctorDialog({
  doctor,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteDoctorDialogProps) {
  return (
    <AlertDialog open={!!doctor} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить врача?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы уверены, что хотите удалить врача &laquo;{doctor?.name}&raquo;? Это действие не
            может быть отменено.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3 justify-end">
          <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
})
