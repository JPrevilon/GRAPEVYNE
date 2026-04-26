import CellarBottleCard from "./CellarBottleCard.jsx";

export default function CellarShelf({ entries, eyebrow, onSelect, selectedEntryId, title }) {
  return (
    <section className="open-cellar-shelf">
      <div className="open-cellar-shelf__header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{entries.length} bottle{entries.length === 1 ? "" : "s"}</span>
      </div>

      <div className="open-cellar-shelf__rail">
        {entries.map((entry) => (
          <CellarBottleCard
            entry={entry}
            isSelected={entry.id === selectedEntryId}
            key={entry.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

