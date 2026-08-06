import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Every field name+type an environment+index has actually been observed to
// have — accumulated server-side from real query results, never a dedicated
// mapping request (see server/src/logLens/es/fieldCache.js). An index that's
// never been queried simply comes back empty; that's expected, not an error.
// Backs path-autocomplete in Preferences > Environments and JQL field-name
// autocomplete in the filter box. `refreshKey`, when passed, just needs to
// change value to force a re-read (e.g. after re-running a tab's query, so a
// newly-observed field shows up without switching tabs away and back).
export function useIndexFields(environment, index, refreshKey) {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (!environment || !index) { setFields([]); return undefined; }
    let cancelled = false;
    api.indexFields(environment, index)
      .then(({ fields: fetched }) => { if (!cancelled) setFields(fetched); })
      .catch(() => { if (!cancelled) setFields([]); });
    return () => { cancelled = true; };
  }, [environment, index, refreshKey]);

  return fields;
}
