import { Check, Clock3, EyeOff, RotateCcw } from "lucide-react";
import { statusLabels, type PostStatus } from "@/lib/types";
const icons = { approved: Check, pending: Clock3, rejected: RotateCcw, hidden: EyeOff };
export function StatusBadge({ status }: { status: PostStatus }) {
  const Icon = icons[status];
  return <span className={`status-badge status-${status}`}><Icon size={14} aria-hidden="true" />{statusLabels[status]}</span>;
}
