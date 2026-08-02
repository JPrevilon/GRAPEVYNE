import {
  CalendarDays,
  Check,
  Heart,
  MapPin,
  Save,
  Star,
  Trash2,
  Wine,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CellarEntryChanges } from "@/api/cellar";
import { isAbortError } from "@/api/client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectControl, TextInput } from "@/components/ui/FormControls";
import { SidePanel } from "@/components/ui/SidePanel";
import { useToast } from "@/components/ui/useToast.js";
import { WineVisual } from "@/components/wine/WineBottleFallback";
import type { CellarEntry, CellarStatus } from "@/types/domain";
import { validateCellarForm } from "@/utils/formValidation.js";

import {
  CELLAR_STATUS_LABELS,
  formatCellarSavedDate,
} from "./cellarPresentation";

const RATING_OPTIONS = [
  { label: "Unrated", value: "" },
  { label: "1 — Not for me", value: "1" },
  { label: "2 — Fine", value: "2" },
  { label: "3 — Good", value: "3" },
  { label: "4 — Excellent", value: "4" },
  { label: "5 — Cellar favorite", value: "5" },
];

const STATUS_OPTIONS = (
  Object.entries(CELLAR_STATUS_LABELS) as Array<[CellarStatus, string]>
).map(([value, label]) => ({ label, value }));

interface ToastApi {
  showToast: (toast: {
    message: string;
    title: string;
    tone?: "error" | "success";
  }) => void;
}

interface CellarFormState {
  favorite: boolean;
  notes: string;
  occasion: string;
  status: CellarStatus;
  userRating: string;
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

interface CellarEntryEditorProps extends Omit<CellarDetailPanelProps, "entry"> {
  entry: CellarEntry;
}

type EditorStatus = "deleting" | "idle" | "saved" | "saving";

function formState(entry: CellarEntry): CellarFormState {
  return {
    favorite: entry.favorite,
    notes: entry.notes ?? "",
    occasion: entry.occasion ?? "",
    status: entry.status,
    userRating: entry.userRating === null ? "" : String(entry.userRating),
  };
}

function isCellarStatus(value: string): value is CellarStatus {
  return Object.prototype.hasOwnProperty.call(CELLAR_STATUS_LABELS, value);
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CellarEntryEditor({
  entry,
  isMutating = false,
  onClose,
  onDelete,
  onUpdate,
}: CellarEntryEditorProps) {
  const { showToast } = useToast() as unknown as ToastApi;
  const [formData, setFormData] = useState<CellarFormState>(() => formState(entry));
  const [status, setStatus] = useState<EditorStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const isMounted = useRef(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const isBusy = isMutating || status === "saving" || status === "deleting";
  const headingId = `cellar-entry-${entry.id}-title`;
  const editorHeadingId = `cellar-entry-${entry.id}-editor-title`;
  const feedbackId = `cellar-entry-${entry.id}-feedback`;
  const notesDescriptionId = `cellar-entry-${entry.id}-notes-description`;
  const savedDate = formatCellarSavedDate(entry.savedAt);
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
    if (isConfirmingDelete) {
      confirmDeleteRef.current?.focus();
    }
  }, [isConfirmingDelete]);

  function markChanged() {
    setStatus("idle");
    setErrorMessage("");
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    const nextValue =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : value;
    setFormData((current) => ({
      ...current,
      [name]: nextValue,
    }));
    markChanged();
  }

  function handleRatingChange(value: string) {
    setFormData((current) => ({ ...current, userRating: value }));
    markChanged();
  }

  function handleStatusChange(value: string) {
    if (!isCellarStatus(value)) {
      return;
    }

    setFormData((current) => ({ ...current, status: value }));
    markChanged();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const validationError = validateCellarForm(formData);

    if (validationError) {
      setStatus("idle");
      setErrorMessage(validationError);
      showToast({
        message: validationError,
        title: "Check the cellar entry",
        tone: "error",
      });
      return;
    }

    setStatus("saving");

    try {
      const updatedEntry = await onUpdate(entry.id, {
        favorite: formData.favorite,
        notes: formData.notes || null,
        occasion: formData.occasion || null,
        status: formData.status,
        userRating: formData.userRating ? Number(formData.userRating) : null,
      });

      if (!isMounted.current) {
        return;
      }

      setFormData(formState(updatedEntry));
      setStatus("saved");
      showToast({
        message: `${entry.wine.name} was updated.`,
        title: "Bottle updated",
      });
    } catch (error) {
      if (!isMounted.current) {
        return;
      }

      if (isAbortError(error)) {
        setStatus("idle");
        return;
      }

      const message = messageFrom(error, "Could not update this bottle.");
      setStatus("idle");
      setErrorMessage(message);
      showToast({ message, title: "Update failed", tone: "error" });
    }
  }

  function beginDelete() {
    setErrorMessage("");
    setIsConfirmingDelete(true);
  }

  function cancelDelete() {
    setIsConfirmingDelete(false);
    window.requestAnimationFrame(() => removeButtonRef.current?.focus());
  }

  async function confirmDelete() {
    setStatus("deleting");
    setErrorMessage("");

    try {
      await onDelete(entry.id);

      if (!isMounted.current) {
        return;
      }

      showToast({
        message: `${entry.wine.name} was removed from your cellar.`,
        title: "Bottle removed",
      });
    } catch (error) {
      if (!isMounted.current) {
        return;
      }

      if (isAbortError(error)) {
        setStatus("idle");
        return;
      }

      const message = messageFrom(error, "Could not remove this bottle.");
      setStatus("idle");
      setErrorMessage(message);
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
          {entry.wine.varietal ? (
            <p className="gv-eyebrow gv-eyebrow--data">{entry.wine.varietal}</p>
          ) : null}
          <h2 id={headingId}>{entry.wine.name}</h2>
          {entry.wine.winery ? <p>{entry.wine.winery}</p> : null}
        </div>
      </div>

      <dl className="gv-cellar-detail__facts">
        <div>
          <dt>Cellar status</dt>
          <dd>{CELLAR_STATUS_LABELS[entry.status]}</dd>
        </div>
        {origin ? (
          <div>
            <dt><MapPin aria-hidden="true" size={14} />Origin</dt>
            <dd>{origin}</dd>
          </div>
        ) : null}
        {entry.wine.vintage ? (
          <div>
            <dt>Vintage</dt>
            <dd>{entry.wine.vintage}</dd>
          </div>
        ) : null}
        {entry.userRating !== null ? (
          <div>
            <dt><Star aria-hidden="true" size={14} />Personal rating</dt>
            <dd>{entry.userRating}/5</dd>
          </div>
        ) : null}
        {entry.favorite ? (
          <div>
            <dt><Heart aria-hidden="true" size={14} />Favorite</dt>
            <dd>Yes</dd>
          </div>
        ) : null}
        {savedDate ? (
          <div>
            <dt><CalendarDays aria-hidden="true" size={14} />Saved</dt>
            <dd>{savedDate}</dd>
          </div>
        ) : null}
      </dl>

      {entry.tags.length > 0 ? (
        <div className="gv-cellar-detail__tags">
          <p className="gv-eyebrow">Saved tags</p>
          <div className="gv-tag-list">
            {entry.tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}
          </div>
        </div>
      ) : null}

      {detailPath ? (
        <ButtonLink size="compact" to={detailPath} variant="ghost">
          View catalog details
        </ButtonLink>
      ) : null}

      <form
        aria-busy={isBusy || undefined}
        aria-describedby={errorMessage ? feedbackId : undefined}
        aria-labelledby={editorHeadingId}
        className="gv-cellar-editor"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="gv-cellar-editor__heading">
          <p className="gv-eyebrow">Private fields</p>
          <h3 id={editorHeadingId}>EDIT YOUR CELLAR ENTRY</h3>
          <p>Only these persisted account fields will be changed.</p>
        </div>

        {errorMessage ? (
          <p className="gv-inline-feedback gv-inline-feedback--error" id={feedbackId} role="alert">
            {errorMessage}
          </p>
        ) : null}
        {status === "saved" ? (
          <p className="gv-inline-feedback gv-inline-feedback--success" role="status">
            <Check aria-hidden="true" size={16} />
            Changes saved to your private cellar.
          </p>
        ) : null}

        <div className="gv-cellar-editor__grid">
          <SelectControl
            disabled={isBusy}
            label="Personal rating"
            onChange={handleRatingChange}
            options={RATING_OPTIONS}
            value={formData.userRating}
          />
          <SelectControl
            disabled={isBusy}
            label="Cellar status"
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            value={formData.status}
          />
        </div>

        <TextInput
          description={`${formData.occasion.length} of 160 characters`}
          disabled={isBusy}
          label="Occasion"
          maxLength={160}
          name="occasion"
          onChange={handleInputChange}
          placeholder="Dinner, gift, celebration…"
          value={formData.occasion}
        />

        <div className="gv-field">
          <label htmlFor={`cellar-entry-${entry.id}-notes`}>Private tasting note</label>
          <p className="gv-field__description" id={notesDescriptionId}>
            {formData.notes.length} of 4000 characters
          </p>
          <textarea
            aria-describedby={notesDescriptionId}
            disabled={isBusy}
            id={`cellar-entry-${entry.id}-notes`}
            maxLength={4000}
            name="notes"
            onChange={handleInputChange}
            placeholder="What did you taste, and would you return to it?"
            rows={6}
            value={formData.notes}
          />
        </div>

        <label className="gv-checkbox">
          <input
            checked={formData.favorite}
            disabled={isBusy}
            name="favorite"
            onChange={handleInputChange}
            type="checkbox"
          />
          <span>Mark as favorite</span>
        </label>

        <div className="gv-cellar-editor__actions">
          <Button
            busyLabel="Saving changes…"
            disabled={isBusy || isConfirmingDelete}
            isBusy={status === "saving"}
            type="submit"
            variant="primary"
          >
            <Save aria-hidden="true" size={17} />
            Save changes
          </Button>

          {!isConfirmingDelete ? (
            <Button
              disabled={isBusy}
              onClick={beginDelete}
              ref={removeButtonRef}
              variant="danger"
            >
              <Trash2 aria-hidden="true" size={17} />
              Remove bottle
            </Button>
          ) : (
            <div className="gv-cellar-delete-confirmation" role="alert">
              <p>
                Remove <strong>{entry.wine.name}</strong>? This cannot be undone.
              </p>
              <div>
                <Button
                  busyLabel="Removing bottle…"
                  isBusy={status === "deleting"}
                  onClick={() => void confirmDelete()}
                  ref={confirmDeleteRef}
                  variant="danger"
                >
                  Confirm removal
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={cancelDelete}
                  variant="text"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </SidePanel>
  );
}

export default function CellarDetailPanel({
  entry,
  isMutating = false,
  onClose,
  onDelete,
  onUpdate,
}: CellarDetailPanelProps) {
  if (!entry) {
    return (
      <SidePanel
        className="gv-cellar-detail gv-cellar-detail--empty"
        id="live-cellar-detail"
        labelledBy="live-cellar-detail-empty-title"
      >
        <Wine aria-hidden="true" size={28} />
        <h2 id="live-cellar-detail-empty-title">SELECT A BOTTLE</h2>
        <p>Choose a saved bottle to inspect and edit its private cellar fields.</p>
      </SidePanel>
    );
  }

  return (
    <CellarEntryEditor
      entry={entry}
      isMutating={isMutating}
      key={entry.id}
      onClose={onClose}
      onDelete={onDelete}
      onUpdate={onUpdate}
    />
  );
}
