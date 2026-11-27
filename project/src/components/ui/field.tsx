type Props = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  errors?: string[];
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  textarea?: boolean;
  step?: string;
  min?: number;
};

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  errors,
  required,
  placeholder,
  autoComplete,
  textarea,
  step,
  min,
}: Props) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          rows={4}
          defaultValue={defaultValue ?? ""}
          required={required}
          placeholder={placeholder}
          className="input"
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue ?? ""}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          step={step}
          min={min}
          className="input"
        />
      )}
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-600">
          {e}
        </span>
      ))}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
