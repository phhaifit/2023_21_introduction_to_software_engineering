import { ReactNode } from "react";

interface ConfirmButtonProps {
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  children: ReactNode;
}

export function ConfirmButton({
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  children,
}: ConfirmButtonProps) {
  const btnClass = `confirm-btn confirm-btn-${variant}`;
  return (
    <button className={btnClass} type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
