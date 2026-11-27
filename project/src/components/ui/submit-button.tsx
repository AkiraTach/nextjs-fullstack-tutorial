"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "处理中…",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variant === "primary" ? "btn" : "btn-outline"} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
