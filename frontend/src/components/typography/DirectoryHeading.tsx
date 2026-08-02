import type { ComponentPropsWithoutRef } from "react";

export type DirectoryHeadingSize = "micro" | "small" | "medium" | "large";
export type DirectoryHeadingWeight = "light" | "regular" | "medium";
export type DirectoryHeadingPlacement = "start" | "inset" | "end";
export type DirectoryHeadingScale = "hero" | "chapter" | "product";

export interface DirectoryHeadingSegment {
  accent?: boolean;
  placement?: DirectoryHeadingPlacement;
  row?: 1 | 2 | 3;
  size: DirectoryHeadingSize;
  text: string;
  weight: DirectoryHeadingWeight;
}

export interface DirectoryHeadingDefinition {
  ariaLabel: string;
  segments: readonly DirectoryHeadingSegment[];
}

interface DirectoryHeadingProps
  extends Omit<
    ComponentPropsWithoutRef<"h1">,
    "aria-label" | "children"
  > {
  ariaLabel: string;
  as?: "h1" | "h2";
  scale?: DirectoryHeadingScale;
  segments: readonly DirectoryHeadingSegment[];
}

/**
 * A single semantic heading with an intentionally asymmetric visual rhythm.
 * The visible segments are decorative; the heading itself exposes one
 * uninterrupted accessible name.
 */
export default function DirectoryHeading({
  ariaLabel,
  as: Heading = "h1",
  className = "",
  scale = "product",
  segments,
  ...headingProps
}: DirectoryHeadingProps) {
  const rows = new Map<number, DirectoryHeadingSegment[]>();

  segments.forEach((segment) => {
    const row = segment.row ?? 1;
    const rowSegments = rows.get(row) ?? [];
    rowSegments.push(segment);
    rows.set(row, rowSegments);
  });

  const classes = [
    "gv-directory-heading",
    `gv-directory-heading--${scale}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Heading aria-label={ariaLabel} className={classes} {...headingProps}>
      <span aria-hidden="true" className="gv-directory-heading__visual">
        {[...rows.entries()].map(([row, rowSegments], rowIndex, allRows) => (
          <span
            className="gv-directory-heading__line"
            data-row={row}
            key={row}
          >
            {rowSegments.map((segment, segmentIndex) => {
              const segmentClasses = [
                "gv-directory-heading__segment",
                `gv-directory-heading__segment--size-${segment.size}`,
                `gv-directory-heading__segment--weight-${segment.weight}`,
                segment.accent
                  ? "gv-directory-heading__segment--accent"
                  : "",
                segment.placement
                  ? `gv-directory-heading__segment--placement-${segment.placement}`
                  : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <span className={segmentClasses} key={`${segment.text}-${segmentIndex}`}>
                  {segment.text}
                  {segmentIndex < rowSegments.length - 1 ? " " : ""}
                </span>
              );
            })}
            {rowIndex < allRows.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </Heading>
  );
}
