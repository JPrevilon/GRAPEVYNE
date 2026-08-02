import { SectionHeading } from "@/components/ui/PageShell";
import type { CellarEntry } from "@/types/domain";

import CellarBottleCard from "./CellarBottleCard";

interface CellarShelfProps {
  disabled?: boolean;
  entries: CellarEntry[];
  onSelect: (entry: CellarEntry) => void;
  selectedEntryId: number | null;
}

export default function CellarShelf({
  disabled = false,
  entries,
  onSelect,
  selectedEntryId,
}: CellarShelfProps) {
  return (
    <section aria-labelledby="live-cellar-list-title" className="gv-cellar-shelf">
      <SectionHeading
        actions={
          <span className="gv-cellar-shelf__count">
            {entries.length} {entries.length === 1 ? "bottle" : "bottles"}
          </span>
        }
        description="Newest saves appear first. Choose a bottle to review or edit its persisted cellar fields."
        eyebrow="Live account data"
        id="live-cellar-list-title"
        title="SAVED BOTTLES"
      />

      <ul className="gv-cellar-shelf__list">
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
