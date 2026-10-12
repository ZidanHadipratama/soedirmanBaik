"use client";
import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";

type Answer = { id: string; label: string };
type Props = {
  options: Answer[];
  multiple: boolean;
  disabled: boolean;
  errors: Record<string, string>;
  onOptionsChange: (options: Answer[]) => void;
  onMultipleChange: (multiple: boolean) => void;
};

export function PollEditor({ options, multiple, disabled, errors, onOptionsChange, onMultipleChange }: Props) {
  return <fieldset className="poll-editor">
    <legend>Pilihan jawaban</legend>
    {options.map((option, index) => {
      const inputId = `poll-option-${option.id}`;
      const errorId = `poll-error-${option.id}`;
      const error = errors[`poll.options.${index}.label`];
      return <div className="poll-editor-option" key={option.id}>
        <div className="field">
          <label htmlFor={inputId}>Pilihan {index + 1}</label>
          <input id={inputId} value={option.label} maxLength={100} required disabled={disabled}
            placeholder={`Jawaban ${index + 1}`} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
            onChange={e => onOptionsChange(options.map(item => item.id === option.id ? { ...item, label: e.target.value } : item))} />
          {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        </div>
        <button type="button" className="icon-button" aria-label={`Hapus pilihan ${index + 1}`} disabled={options.length <= 2 || disabled}
          onClick={() => onOptionsChange(options.filter(item => item.id !== option.id))}><X size={18} /></button>
      </div>;
    })}
    {errors["poll.options"] && <p className="field-error" role="alert">{errors["poll.options"]}</p>}
    {options.length < 12 && <Button type="button" variant="secondary" disabled={disabled}
      onClick={() => onOptionsChange([...options, { id: crypto.randomUUID(), label: "" }])}><Plus size={18} />Tambah pilihan</Button>}
    <label className="poll-switch"><input type="checkbox" checked={multiple} onChange={e => onMultipleChange(e.target.checked)} disabled={disabled} />Izinkan beberapa jawaban</label>
  </fieldset>;
}
