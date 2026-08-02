interface BrandLockupProps {
  className?: string;
  compact?: boolean;
  showDescriptor?: boolean;
}

export default function BrandLockup({
  className = "",
  compact = false,
  showDescriptor = true,
}: BrandLockupProps) {
  const classes = [
    "gv-brand-lockup",
    compact ? "gv-brand-lockup--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <img
        alt=""
        aria-hidden="true"
        className="gv-brand-lockup__mark"
        src="/assets/brand/grapevyne-monogram.svg"
      />
      <span className="gv-brand-lockup__type">
        <span className="gv-brand-lockup__name">GRAPEVYNE</span>
        {showDescriptor ? (
          <span className="gv-brand-lockup__descriptor">
            PRIVATE WINE DIRECTORY
          </span>
        ) : null}
      </span>
    </span>
  );
}
