import { forwardRef, useState } from 'react';

// Finds the whitespace-delimited word containing `caret` in `value`.
function wordAt(value, caret) {
  let start = caret;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  let end = caret;
  while (end < value.length && !/\s/.test(value[end])) end++;
  return { start, end, word: value.slice(start, end) };
}

// The JQL filter box — a plain text input, plus field-name autocomplete for
// the word under the caret, sourced from the active tab's cached index
// fields (see useIndexFields). Only meaningful for remote-query tabs, which
// have a real index mapping to suggest from; `fields` is simply empty for
// file tabs, so no suggestions ever appear there.
export const FilterInput = forwardRef(function FilterInput({ value, onChange, fields, placeholder }, ref) {
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);

  const { start, end, word } = wordAt(value, caret);
  const bareWord = word.replace(/^-/, '');
  const suggestions = (fields.length && bareWord && !bareWord.includes(':'))
    ? fields.filter((f) => f.name.toLowerCase().includes(bareWord.toLowerCase())).slice(0, 20)
    : [];

  const syncCaret = (e) => setCaret(e.target.selectionStart ?? e.target.value.length);

  const applySuggestion = (fieldName) => {
    const negate = value[start] === '-' ? '-' : '';
    const inserted = `${negate}${fieldName}:`;
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    setOpen(false);
    const pos = start + inserted.length;
    requestAnimationFrame(() => {
      const el = ref?.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  return (
    <div className="filter-input-wrap">
      <input
        ref={ref}
        className="filter-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); syncCaret(e); setOpen(true); }}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="filter-suggest">
          {suggestions.map((f) => (
            <div key={f.name} className="filter-suggest-item" onMouseDown={() => applySuggestion(f.name)}>
              {f.name}
              <span className="filter-suggest-type">{f.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
