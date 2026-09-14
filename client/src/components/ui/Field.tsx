import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

function inputClasses(invalid: boolean): string {
  return cn(
    'block h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink-950 transition-colors placeholder:text-ink-400',
    'focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-600',
    invalid
      ? 'border-brand-600 focus:ring-brand-200'
      : 'border-ink-300 focus:border-ink-950 focus:ring-ink-200',
  );
}

function useFieldIds(error: string | undefined, hint: ReactNode) {
  const id = useId();
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

function FieldMessages({
  hint,
  hintId,
  error,
  errorId,
}: {
  hint: ReactNode;
  hintId: string | undefined;
  error: string | undefined;
  errorId: string | undefined;
}) {
  return (
    <>
      {hintId && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="mt-1.5 text-xs font-semibold text-brand-700">
          {error}
        </p>
      )}
    </>
  );
}

export function TextField({ label, error, hint, className, ...input }: TextFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(error, hint);

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink-900">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn('mt-1.5', inputClasses(Boolean(error)))}
        {...input}
      />
      <FieldMessages hint={hint} hintId={hintId} error={error} errorId={errorId} />
    </div>
  );
}

export function PasswordField({
  label,
  error,
  hint,
  className,
  ...input
}: Omit<TextFieldProps, 'type'>) {
  const { id, hintId, errorId, describedBy } = useFieldIds(error, hint);
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink-900">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClasses(Boolean(error)), 'pr-12')}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-500 transition-colors hover:text-ink-950"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-5" />
          ) : (
            <Eye aria-hidden className="size-5" />
          )}
        </button>
      </div>
      <FieldMessages hint={hint} hintId={hintId} error={error} errorId={errorId} />
    </div>
  );
}

export function CheckboxField({
  label,
  error,
  className,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: ReactNode;
  error?: string | undefined;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 accent-brand-600"
          {...input}
        />
        <label htmlFor={id} className="text-sm text-ink-700">
          {label}
        </label>
      </div>
      {errorId && (
        <p id={errorId} className="mt-1.5 text-xs font-semibold text-brand-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormAlert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success';
}) {
  if (tone === 'success') {
    return (
      <div
        role="status"
        className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm font-semibold text-ink-900"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"
    >
      {children}
    </div>
  );
}
