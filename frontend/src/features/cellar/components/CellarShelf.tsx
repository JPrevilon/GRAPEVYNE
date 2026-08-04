import { SectionHeading } from "@/components/ui/PageShell";
import type { CellarViewMode } from "@/features/cellar/cellarOrganization";
import type { CellarEntry } from "@/types/domain";

import CellarBottleCard from "./CellarBottleCard";

interface CellarShelfProps {
  disabled?: boolean;
  entries: CellarEntry[];
  groupLabel?: string;
  onSelect: (entry: CellarEntry) => void;
  selectedEntryId: number | null;
  viewMode?: CellarViewMode;
}

export default function CellarShelf({
  disabled = false,
  entries,
  groupLabel = "All bottles",
  onSelect,
  selectedEntryId,
  viewMode = "list",
}: CellarShelfProps) {
  return (
    <section aria-labelledby="live-cellar-list-title" className="gv-cellar-shelf">
      <SectionHeading
        actions={
          <span className="gv-cellar-shelf__count">
            {entries.length} {entries.length === 1 ? "bottle" : "bottles"}
          </span>
        }
        description="Choose a bottle to review or edit its persisted private tasting memory."
        eyebrow="Live account data"
        id="live-cellar-list-title"
        title={groupLabel.toLocaleUpperCase()}
      />

      <ul className="gv-cellar-shelf__list" data-view={viewMode}>
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <CellarBottleCard
              disabled={disabled}
              entry={entry}
              index={index + 1}
              isSelected={entry.id === selectedEntryId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
