import { useRef } from 'react';

// A thin drag handle on a header cell's right edge — drag to resize that
// column. Width changes are reported live (not just on mouseup) so the
// header and every row visibly track the drag.
export function ColumnResizeHandle({ width, onChange }) {
  const dragRef = useRef(null);

  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <span
      className="col-resize-handle"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
