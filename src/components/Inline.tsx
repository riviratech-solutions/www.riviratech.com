export function Inline({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <p className={`biz-inline ${className}`}>
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 && (
            <>
              {" "}
              <span className="sep">·</span>{" "}
            </>
          )}
          {item}
        </span>
      ))}
    </p>
  );
}
