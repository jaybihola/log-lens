import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Every JSON field name an index's mapping actually has — the server
// caches this per environment+index (see es/fieldCache.js's
// indexFieldsCache), fetched once and reused for the life of the process.
// Backs path-autocomplete in Preferences > Environments and JQL field-name
// autocomplete in the filter box.
export function useIndexFields(environment, index) {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (!environment || !index) { setFields([]); return undefined; }
    let cancelled = false;
    api.indexFields(environment, index)
      .then(({ fields: fetched }) => { if (!cancelled) setFields(fetched); })
      .catch(() => { if (!cancelled) setFields([]); });
    return () => { cancelled = true; };
  }, [environment, index]);

  return fields;
}
