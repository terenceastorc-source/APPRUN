import type { ReactNode } from 'react';

export function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p className="field-error" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted empty-line">{children}</p>;
}

/** Échelle de boutons 1…n (effort, forme). */
export function Scale({ value, max, onChange, labels, name }: { value?: number; max: number; onChange(v: number | undefined): void; labels: string[]; name: string }) {
  return (
    <div className="scale" role="group" aria-label={name} style={{ '--n': max } as React.CSSProperties}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button type="button" key={n} className={value === n ? 'chip active' : 'chip'} aria-pressed={value === n} title={labels[n - 1]} onClick={() => onChange(value === n ? undefined : n)}>
          {n}
        </button>
      ))}
      <span className="muted small scale-label">{value ? labels[value - 1] : 'Optionnel'}</span>
    </div>
  );
}

export const RPE_LABELS = ['Très facile', 'Facile', 'Modéré', 'Assez dur', 'Dur', 'Dur +', 'Très dur', 'Très dur +', 'Extrême', 'Maximal'];
export const FORM_LABELS = ['Épuisé', 'Fatigué', 'Correct', 'En forme', 'Au top'];
