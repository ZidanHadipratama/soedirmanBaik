"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Modal({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (value: boolean) => void; title: string; description?: string; children: ReactNode; className?: string }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" />
    <Dialog.Content className={cn("dialog-content", className)} aria-describedby={description ? "modal-description" : undefined}>
      <div className="dialog-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Tutup"><X size={22} /></Dialog.Close></div>
      {description && <Dialog.Description id="modal-description" className="dialog-description">{description}</Dialog.Description>}
      {children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
