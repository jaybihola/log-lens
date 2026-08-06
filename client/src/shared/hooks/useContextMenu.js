import { useCallback, useState } from 'react';

// Right-click state for a ContextMenu — call openMenu(e, items) from an
// onContextMenu handler (it preventDefaults the browser's own menu for
// you), render <ContextMenu {...menu} onClose={closeMenu} /> when `menu`
// is non-null. One instance covers an entire list (e.g. all rows in a tab
// bar) since `items` is computed fresh per open call, not baked into props.
//
// The optional third arg to openMenu is that row's own id — once set, the
// list can look up isMenuActive(id) to keep exactly that row looking
// hovered for as long as the menu stays open (add a `menu-target` class),
// while gating every other row's real :hover CSS behind `!!menu` (add a
// `menu-open` class to the list's container). Without this, moving the
// cursor from the row to the menu (which portals to <body>, so it's not a
// descendant) drops the row out of :hover mid-interaction, and passing over
// other rows on the way there lights them up too.
export function useContextMenu() {
  const [menu, setMenu] = useState(null); // null | { x, y, items, activeId }

  const openMenu = useCallback((e, items, activeId = null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items, activeId });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);
  const isMenuActive = useCallback((id) => !!menu && menu.activeId === id, [menu]);

  return { menu, openMenu, closeMenu, isMenuActive };
}
