import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// A fold filter's chip input: selected values as removable chips, plus a
// text box that autocompletes against the backend's distinct values for
// that field (merged with any configured preset values), with freeform
// entry (Enter) always allowed for values the backend hasn't indexed yet.
export function FoldFilterChips({ filter, environment, index, values, onChange }) {
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState(filter.presetValues || []);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.esFieldValues(environment, filter.key, index)
      .then(({ values: fetched }) => {
        if (cancelled) return;
        const merged = [...new Set([...(filter.presetValues || []), ...fetched])];
        setSuggestions(merged);
      })
      .catch(() => { /* autocomplete is a convenience — leave preset values as the fallback */ });
    return () => { cancelled = true; };
  }, [environment, index, filter.key, filter.presetValues]);

  const addValue = (value) => {
    const trimmed = value.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInputText('');
    setOpen(false);
  };
  const removeValue = (value) => onChange(values.filter((v) => v !== value));

  const filtered = suggestions.filter((s) => !values.includes(s) && s.toLowerCase().includes(inputText.toLowerCase()));

  return (
    <div className="fold-filter">
      <label>{filter.label}</label>
      <div className="fold-filter-chips">
        {values.map((v) => (
          <span className="preset-chip" key={v}>
            <span className="preset-name">{v}</span>
            <button type="button" onClick={() => removeValue(v)}>×</button>
          </span>
        ))}
        <div className="fold-filter-input-wrap">
          <input
            type="text"
            value={inputText}
            placeholder={values.length ? '' : 'type to filter, Enter to add'}
            onChange={(e) => { setInputText(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValue(inputText); } }}
          />
          {open && filtered.length > 0 && (
            <div className="fold-filter-suggest">
              {filtered.slice(0, 20).map((s) => (
                <div key={s} className="fold-filter-suggest-item" onMouseDown={() => addValue(s)}>{s}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
