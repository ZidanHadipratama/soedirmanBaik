import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; asChild?: boolean };
export function Button({ className, variant = "primary", asChild = false, ...props }: Props) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn("button", `button-${variant}`, className)} {...props} />;
}
