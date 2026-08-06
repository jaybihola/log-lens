import { useRef } from 'react';

// A thin drag handle on the fields sidebar's right edge — same drag math as
// ColumnResizeHandle, just anchored full-height along the sidebar's edge
// instead of a header cell's.
export function SidebarResizeHandle({ width, onChange }) {
  const dragRef = useRef(null);

  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.classList.add('col-resizing');

    const onMove = (ev) => {
      const { startX, startWidth } = dragRef.current;
      onChange(startWidth + (ev.clientX - startX));
    };
    const onUp = () => {
      document.body.classList.remove('col-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return <div className="fields-sidebar-resize-handle" onMouseDown={onMouseDown} />;
}
