import {
  CalendarDays,
  Heart,
  MapPin,
  Star,
  Trash2,
  Wine,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CellarEntryChanges } from "@/api/cellar";
import { isAbortError } from "@/api/client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { useToast } from "@/components/ui/useToast.js";
import { WineVisual } from "@/components/wine/WineBottleFallback";
import type { CellarEntry } from "@/types/domain";

import CellarMemoryEditor from "./CellarMemoryEditor";
import {
  CELLAR_STATUS_LABELS,
  formatCellarSavedDate,
} from "./cellarPresentation";

interface ToastApi {
  showToast: (toast: {
    message: string;
    title: string;
    tone?: "error" | "success";
  }) => void;
}

interface CellarDetailPanelProps {
  entry: CellarEntry | null;
  isMutating?: boolean;
  onClose: () => void;
  onDelete: (entryId: number) => Promise<number>;
  onUpdate: (
    entryId: number,
    changes: CellarEntryChanges,
  ) => Promise<CellarEntry>;
}

function formatTastedDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parsed);
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Could not remove this bottle.";
}

function CellarEntryDetail({
  entry,
  isMutating = false,
  onClose,
  onDelete,
  onUpdate,
}: CellarDetailPanelProps & { entry: CellarEntry }) {
  const { showToast } = useToast() as unknown as ToastApi;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const isMounted = useRef(false);
  const isBusy = isMutating || isDeleting;
  const headingId = `cellar-entry-${entry.id}-title`;
  const deleteFeedbackId = `cellar-entry-${entry.id}-delete-feedback`;
  const savedDate = formatCellarSavedDate(entry.savedAt);
  const tastedDate = formatTastedDate(entry.tastedOn);
  const origin = [entry.wine.region, entry.wine.country].filter(Boolean).join(", ");
  const detailPath = entry.wine.externalWineId
    ? `/wines/${encodeURIComponent(entry.wine.externalWineId)}`
    : null;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isConfirmingDelete) confirmDeleteRef.current?.focus();
  }, [isConfirmingDelete]);

  function beginDelete() {
    setDeleteError("");
    setIsConfirmingDelete(true);
  }

  function cancelDelete() {
    setIsConfirmingDelete(false);
    window.requestAnimationFrame(() => removeButtonRef.current?.focus());
  }

  async function confirmDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await onDelete(entry.id);
      if (!isMounted.current) return;
      showToast({
        message: `${entry.wine.name} was removed from your cellar.`,
        title: "Bottle removed",
      });
    } catch (error) {
      if (!isMounted.current) return;
      if (isAbortError(error)) {
        setIsDeleting(false);
        return;
      }

      const message = messageFrom(error);
      setIsDeleting(false);
      setDeleteError(message);
      showToast({ message, title: "Remove failed", tone: "error" });
    }
  }

  return (
    <SidePanel className="gv-cellar-detail" id="live-cellar-detail" labelledBy={headingId}>
      <div className="gv-cellar-detail__selection">
        <span className="gv-eyebrow">Selected cellar entry</span>
        <Button
          className="gv-cellar-detail__close"
          disabled={isBusy}
          onClick={onClose}
          size="compact"
          variant="text"
        >
          <X aria-hidden="true" size={16} />
          Close details
        </Button>
      </div>

      <div className="gv-cellar-detail__hero">
        <div className="gv-cellar-detail__bottle">
          <WineVisual
            alt={entry.wine.imageUrl ? `${entry.wine.name} bottle` : ""}
            imageUrl={entry.wine.imageUrl}
            label={entry.wine.name}
            varietal={entry.wine.varietal}
          />
        </div>
        <div>
          {entry.memoryTitle ? (
            <p className="gv-eyebrow gv-eyebrow--data">{entry.memoryTitle}</p>
          ) : entry.wine.varietal ? (
            <p className="gv-eyebrow gv-eyebrow--data">{entry.wine.varietal}</p>
          ) : null}
          <h2 id={headingId}>{entry.wine.name}</h2>
          {entry.wine.winery ? <p>{entry.wine.winery}</p> : null}
        </div>
      </div>

      <dl className="gv-cellar-detail__facts">
        <div><dt>Cellar status</dt><dd>{CELLAR_STATUS_LABELS[entry.status]}</dd></div>
        {origin ? <div><dt><MapPin aria-hidden="true" size={14} />Origin</dt><dd>{origin}</dd></div> : null}
        {entry.wine.vintage ? <div><dt>Vintage</dt><dd>{entry.wine.vintage}</dd></div> : null}
        {entry.userRating !== null ? <div><dt><Star aria-hidden="true" size={14} />Personal rating</dt><dd>{entry.userRating}/5</dd></div> : null}
        {entry.favorite ? <div><dt><Heart aria-hidden="true" size={14} />Favorite</dt><dd>Yes</dd></div> : null}
        {savedDate ? <div><dt><CalendarDays aria-hidden="true" size={14} />Saved</dt><dd>{savedDate}</dd></div> : null}
        {tastedDate ? <div><dt>Tasted</dt><dd><time dateTime={entry.tastedOn ?? undefined}>{tastedDate}</time></dd></div> : null}
        {entry.location ? <div><dt>Location</dt><dd>{entry.location}</dd></div> : null}
        {entry.pairing ? <div><dt>Pairing</dt><dd>{entry.pairing}</dd></div> : null}
        {entry.openedWith ? <div><dt>Opened with</dt><dd>{entry.openedWith}</dd></div> : null}
        {entry.wouldBuyAgain !== null ? <div><dt>Would buy again</dt><dd>{entry.wouldBuyAgain ? "Yes" : "No"}</dd></div> : null}
      </dl>

      {entry.tags.length > 0 ? (
        <div className="gv-cellar-detail__tags">
          <p className="gv-eyebrow">Saved tags</p>
          <div className="gv-tag-list">
            {entry.tags.map((tag) => <span key={tag.toLocaleLowerCase()}>{tag}</span>)}
          </div>
        </div>
      ) : null}

      {detailPath ? (
        <ButtonLink size="compact" to={detailPath} variant="ghost">
          View catalog details
        </ButtonLink>
      ) : null}

      <CellarMemoryEditor
        entry={entry}
        isMutating={isBusy}
        onUpdate={onUpdate}
      />

      <section aria-labelledby={`cellar-entry-${entry.id}-remove-title`} className="gv-cellar-remove">
        <p className="gv-eyebrow">Cellar management</p>
        <h3 id={`cellar-entry-${entry.id}-remove-title`}>REMOVE THIS BOTTLE</h3>
        {deleteError ? (
          <p className="gv-inline-feedback gv-inline-feedback--error" id={deleteFeedbackId} role="alert">
            {deleteError}
          </p>
        ) : null}
        {!isConfirmingDelete ? (
          <Button disabled={isBusy} onClick={beginDelete} ref={removeButtonRef} variant="danger">
            <Trash2 aria-hidden="true" size={17} />
            Remove bottle
          </Button>
        ) : (
          <div className="gv-cellar-delete-confirmation" role="alert">
            <p>Remove <strong>{entry.wine.name}</strong>? This cannot be undone.</p>
            <div>
              <Button
                busyLabel="Removing bottle…"
                isBusy={isDeleting}
                onClick={() => void confirmDelete()}
                ref={confirmDeleteRef}
                variant="danger"
              >
                Confirm removal
              </Button>
              <Button disabled={isBusy} onClick={cancelDelete} variant="text">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </SidePanel>
  );
}

export default function CellarDetailPanel(props: CellarDetailPanelProps) {
  if (!props.entry) {
    return (
      <SidePanel
        className="gv-cellar-detail gv-cellar-detail--empty"
        id="live-cellar-detail"
        labelledBy="live-cellar-detail-empty-title"
      >
        <Wine aria-hidden="true" size={28} />
        <h2 id="live-cellar-detail-empty-title">SELECT A BOTTLE</h2>
        <p>Choose a saved bottle to inspect and edit its private tasting memory.</p>
      </SidePanel>
    );
  }

  return <CellarEntryDetail {...props} entry={props.entry} key={props.entry.id} />;
}
