import { RotateCcw, X } from "lucide-react";

export default function CellarControls({ activeSection, onCloseDetails, onReset, selectedBottle }) {
  if (!activeSection && !selectedBottle) {
    return null;
  }

  return (
    <div className="interactive-cellar-controls" aria-label="Cellar controls">
      {activeSection ? (
        <button className="secondary-button" type="button" onClick={onReset}>
          <RotateCcw size={17} />
          Full Cellar
        </button>
      ) : null}
      {selectedBottle ? (
        <button className="secondary-button" type="button" onClick={onCloseDetails}>
          <X size={17} />
          Close Details
        </button>
      ) : null}
    </div>
  );
}
