"use client";

import { createContext, use, useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";

const FormStateContext = createContext<FormState>({});
export const useFieldState = (name: string) => {
  const s = use(FormStateContext);
  return { error: s.fieldErrors?.[name], value: s.values?.[name] };
};

// A form wired to a Server Action that returns FormState (errors, field errors, values to keep).
export function ActionForm({
  action,
  children,
  className = "form",
  resetOnSuccess = false,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {state.error && (
        <div className="notice notice--error" role="alert">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="notice notice--success" role="status">
          {state.ok}
        </div>
      )}
      <FormStateContext value={state}>{children}</FormStateContext>
    </form>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
  min?: string;
  max?: string;
  step?: string;
  accept?: string;
};

export function Field({ name, label, type = "text", required, hint, defaultValue, className, ...rest }: FieldProps) {
  const { error, value } = useFieldState(name);
  const keep = type !== "password" && type !== "file";
  return (
    <div className={`field${error ? " has-error" : ""}${className ? ` ${className}` : ""}`}>
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${name}-desc` : undefined}
        defaultValue={keep ? (value ?? defaultValue) : undefined}
        key={keep ? (value ?? defaultValue ?? "") : undefined}
        {...rest}
      />
      {(hint || error) && (
        <div id={`${name}-desc`}>
          {error && <div className="field-error">{error}</div>}
          {hint && <div className="hint">{hint}</div>}
        </div>
      )}
    </div>
  );
}

export function TextArea({ name, label, required, hint, defaultValue, className }: FieldProps) {
  const { error, value } = useFieldState(name);
  return (
    <div className={`field${error ? " has-error" : ""}${className ? ` ${className}` : ""}`}>
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <textarea id={name} name={name} required={required} defaultValue={value ?? defaultValue} key={value ?? defaultValue ?? ""} />
      {error && <div className="field-error">{error}</div>}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Select({
  name,
  label,
  options,
  required,
  hint,
  defaultValue,
  className,
  placeholder = "Select…",
}: FieldProps & { options: { value: string; label: string }[] }) {
  const { error, value } = useFieldState(name);
  return (
    <div className={`field${error ? " has-error" : ""}${className ? ` ${className}` : ""}`}>
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <select id={name} name={name} required={required} defaultValue={value ?? defaultValue ?? ""} key={value ?? defaultValue ?? ""}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div className="field-error">{error}</div>}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Checkboxes({ name, label, options, defaults = [], hint }: { name: string; label: string; options: string[]; defaults?: string[]; hint?: string }) {
  const { error, value } = useFieldState(name);
  const selected = value ? value.split("\n") : defaults;
  return (
    <fieldset className={`field${error ? " has-error" : ""}`} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
        {label}
      </legend>
      <div className="choices">
        {options.map((o) => (
          <label className="choice" key={o}>
            <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} />
            {o}
          </label>
        ))}
      </div>
      {error && <div className="field-error">{error}</div>}
      {hint && <div className="hint">{hint}</div>}
    </fieldset>
  );
}

export function Checkbox({ name, children, required }: { name: string; children: React.ReactNode; required?: boolean }) {
  const { error, value } = useFieldState(name);
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label className="choice">
        <input type="checkbox" name={name} value="yes" required={required} defaultChecked={value === "yes"} />
        <span>{children}</span>
      </label>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function Submit({ children, className = "btn btn--primary", pendingText = "Please wait…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

// Small button-only forms for admin actions (no state shown)
export function ConfirmButton({ children, className = "btn btn--light btn--xs", confirm }: { children: React.ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
