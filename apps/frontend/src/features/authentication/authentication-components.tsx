import { useRef, useState } from "react";

import "./authentication-components.css";

// ---------------------------------------------------------------------------
// AuthCard
// ---------------------------------------------------------------------------

type AuthCardProps = {
  title: string;
  children: React.ReactNode;
};

export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="auth-card">
      <h1 className="auth-card__title">{title}</h1>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthBrand
// ---------------------------------------------------------------------------

export function AuthBrand() {
  return (
    <div className="auth-brand">
      <span className="auth-brand__mark" aria-hidden="true">
        V
      </span>
      <span className="auth-brand__name">VCP Platform</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthInlineError
// ---------------------------------------------------------------------------

type AuthInlineErrorProps = {
  message: string;
};

export function AuthInlineError({ message }: AuthInlineErrorProps) {
  return (
    <span className="auth-inline-error" role="alert">
      {message}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AuthField
// ---------------------------------------------------------------------------

type AuthFieldProps = {
  label: string;
  type: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  helperText?: string;
  error?: string;
  id?: string;
  disabled?: boolean;
  autoComplete?: string;
};

export function AuthField({
  label,
  type,
  value,
  onChange,
  onBlur,
  helperText,
  error,
  id,
  disabled = false,
  autoComplete
}: AuthFieldProps) {
  const fieldId =
    id ?? `auth-field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  const describedBy =
    [helperText ? helperId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <label className="auth-field" htmlFor={fieldId}>
      <span className="auth-field__label">{label}</span>
      <input
        id={fieldId}
        className={`auth-field__input${error ? " auth-field__input--invalid" : ""}`}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {helperText && !error ? (
        <span id={helperId} className="auth-field__helper">
          {helperText}
        </span>
      ) : null}
      {error ? <AuthInlineError message={error} /> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// AuthAlert
// ---------------------------------------------------------------------------

type AuthAlertProps = {
  message: string;
};

export function AuthAlert({ message }: AuthAlertProps) {
  return (
    <div className="auth-alert" role="alert" aria-live="assertive">
      <span className="auth-alert__icon" aria-hidden="true">
        !
      </span>
      <span className="auth-alert__message">{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthPrimaryButton
// ---------------------------------------------------------------------------

type AuthPrimaryButtonProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
};

export function AuthPrimaryButton({
  label,
  onClick,
  disabled = false,
  loading = false,
  type = "button"
}: AuthPrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className="auth-primary-button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className="auth-primary-button__spinner" aria-hidden="true" />
          <span>Please wait</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AuthLinkText
// ---------------------------------------------------------------------------

type AuthLinkTextProps = {
  children: React.ReactNode;
  onClick: () => void;
};

export function AuthLinkText({ children, onClick }: AuthLinkTextProps) {
  return (
    <button type="button" className="auth-link-text" onClick={onClick}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AppShellTopBar
// ---------------------------------------------------------------------------

type AppShellTopBarProps = {
  brand: React.ReactNode;
  children?: React.ReactNode;
};

export function AppShellTopBar({ brand, children }: AppShellTopBarProps) {
  return (
    <header className="app-shell-top-bar">
      <div className="app-shell-top-bar__brand">{brand}</div>
      {children ? (
        <div className="app-shell-top-bar__right">{children}</div>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// UserMenu
// ---------------------------------------------------------------------------

type UserMenuItem = {
  key: string;
  label: string;
  danger?: boolean;
};

type UserMenuProps = {
  email: string;
  items: UserMenuItem[];
  onSelect: (key: string) => void;
};

export function UserMenu({ email, items, onSelect }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function toggle() {
    setOpen((prev) => !prev);
  }

  function handleSelect(key: string) {
    setOpen(false);
    onSelect(key);
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.relatedTarget)
    ) {
      setOpen(false);
    }
  }

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="user-menu" ref={containerRef} onBlur={handleBlur}>
      <button
        type="button"
        id="user-menu-trigger"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        onClick={toggle}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="user-menu__email">{email}</span>
        <span
          className={`user-menu__chevron${open ? " user-menu__chevron--open" : ""}`}
          aria-hidden="true"
        >
          &#9662;
        </span>
      </button>

      {open ? (
        <ul
          className="user-menu__dropdown"
          role="menu"
          aria-labelledby="user-menu-trigger"
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                className={`user-menu__item${item.danger ? " user-menu__item--danger" : ""}`}
                onClick={() => handleSelect(item.key)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
