export default function WineBottleMark({ tone = "red" }) {
  return (
    <div className={`wine-bottle-mark wine-bottle-mark--${tone}`} aria-hidden="true">
      <span className="wine-bottle-mark__neck" />
      <span className="wine-bottle-mark__body">
        <span className="wine-bottle-mark__label" />
      </span>
    </div>
  );
}

