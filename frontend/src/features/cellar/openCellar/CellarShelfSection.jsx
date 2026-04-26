import BottleCard from "./BottleCard.jsx";

export default function CellarShelfSection({
  activeShelf,
  onBottleSelect,
  selectedBottleId,
  shelf,
}) {
  const isActive = activeShelf === shelf.id;

  return (
    <section
      className={isActive ? "oc-shelf is-active" : "oc-shelf"}
      data-shelf-id={shelf.id}
      id={`cellar-${shelf.id}`}
    >
      <div className="oc-shelf__header">
        <div>
          <p className="eyebrow">{shelf.eyebrow}</p>
          <h2>{shelf.title}</h2>
          <p>{shelf.mood}</p>
        </div>
        <span className="oc-shelf__count">
          {shelf.entries.length} bottle{shelf.entries.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="oc-shelf__rail" aria-label={`${shelf.title} wines`}>
        {shelf.entries.map((entry, index) => (
          <BottleCard
            entry={entry}
            index={index}
            isSelected={entry.id === selectedBottleId}
            key={`${shelf.id}-${entry.id}`}
            onSelect={onBottleSelect}
          />
        ))}
      </div>
    </section>
  );
}
