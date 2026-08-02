import { Search } from "lucide-react";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
} from "react";

import { Button } from "./Button";

function describedBy(...ids: Array<string | false | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  description?: string;
  error?: string;
  label: string;
}

export function TextInput({
  className = "",
  description,
  error,
  id,
  label,
  ...props
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`gv-field ${className}`.trim()}>
      <label htmlFor={inputId}>{label}</label>
      {description ? (
        <p className="gv-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <input
        {...props}
        aria-describedby={describedBy(descriptionId, errorId)}
        aria-invalid={Boolean(error) || undefined}
        id={inputId}
      />
      {error ? (
        <p className="gv-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput(props: Omit<TextInputProps, "type">) {
  return <TextInput {...props} type="password" />;
}

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectControlProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  description?: string;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function SelectControl({
  description,
  id,
  label,
  onChange,
  options,
  ...props
}: SelectControlProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = description ? `${selectId}-description` : undefined;

  return (
    <div className="gv-field gv-field--select">
      <label htmlFor={selectId}>{label}</label>
      {description ? (
        <p className="gv-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <select
        {...props}
        aria-describedby={descriptionId}
        id={selectId}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FilterChipProps {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export function FilterChip({
  active = false,
  children,
  disabled,
  onClick,
}: FilterChipProps) {
  return (
    <button
      aria-pressed={active}
      className="gv-filter-chip"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

interface NaturalLanguageSearchProps {
  buttonLabel: string;
  description?: string;
  error?: string;
  id: string;
  isBusy?: boolean;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  value: string;
}

export function NaturalLanguageSearch({
  buttonLabel,
  description,
  error,
  id,
  isBusy = false,
  label,
  maxLength = 200,
  onChange,
  onSubmit,
  placeholder,
  value,
}: NaturalLanguageSearchProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="gv-natural-search" onSubmit={handleSubmit} role="search">
      <label className="gv-natural-search__label" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p className="gv-natural-search__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <div className="gv-natural-search__control">
        <Search aria-hidden="true" size={20} />
        <input
          aria-describedby={describedBy(descriptionId, errorId)}
          aria-invalid={Boolean(error) || undefined}
          autoComplete="off"
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
        <Button
          busyLabel="Searching…"
          isBusy={isBusy}
          type="submit"
          variant="primary"
        >
          {buttonLabel}
        </Button>
      </div>
      {error ? (
        <p className="gv-natural-search__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
