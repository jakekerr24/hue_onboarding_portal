// Animated show/hide for a block of content. Uses a 0fr -> 1fr grid row so the height animates
// to whatever the content needs (no max-height cap that could clip long text). Collapsed
// content is also hidden from keyboard and screen readers.
export default function Collapsible({ open, id, children }) {
  return (
    <div id={id} className={open ? 'collapsible open' : 'collapsible'} aria-hidden={!open}>
      <div className="collapsible-inner">{children}</div>
    </div>
  );
}
