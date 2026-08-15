"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConsultationDisclaimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirming?: boolean;
}

export function ConsultationDisclaimerDialog({
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
}: ConsultationDisclaimerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-teal/25 pt-0 sm:max-w-md">
        {/* Фирменная бирюзовая линия — как в карточках врача и отзывов */}
        <span
          aria-hidden="true"
          className="-mx-6 block h-1 bg-gradient-to-r from-teal via-primary to-transparent"
        />
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 ring-1 ring-teal/20">
            <AlertTriangle className="h-6 w-6 text-teal" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-xl">Важно помнить</DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed text-pretty">
            На онлайн-консультации врач не в праве поставить окончательный диагноз, открыть или
            закрыть больничный, выписать рецепт.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="w-full text-muted-foreground hover:bg-teal/10 hover:text-teal sm:w-auto"
          >
            Отмена
          </Button>
          <Button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full bg-teal text-teal-foreground hover:bg-teal/90 sm:w-auto"
          >
            Понятно, продолжить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
