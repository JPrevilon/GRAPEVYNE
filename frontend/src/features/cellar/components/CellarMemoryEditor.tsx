import { Check, Save } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CellarEntryChanges } from "@/api/cellar";
import { isAbortError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { SelectControl, TextInput } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/useToast.js";
import type { CellarEntry, CellarStatus } from "@/types/domain";

import { CELLAR_STATUS_LABELS } from "./cellarPresentation";

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

type BuyAgainChoice = "no" | "unanswered" | "yes";
type EditorStatus = "idle" | "saved" | "saving";

interface CellarMemoryFormState {
  favorite: boolean;
  location: string;
  memoryTitle: string;
  notes: string;
  occasion: string;
  openedWith: string;
  pairing: string;
  status: CellarStatus;
  tags: string;
  tastedOn: string;
  userRating: string;
  wouldBuyAgain: BuyAgainChoice;
}

type FieldName = keyof CellarMemoryFormState;
type FieldErrors = Partial<Record<FieldName, string>>;

interface CellarMemoryEditorProps {
  entry: CellarEntry;
  isMutating?: boolean;
  onUpdate: (
    entryId: number,
    changes: CellarEntryChanges,
  ) => Promise<CellarEntry>;
}

interface ToastApi {
  showToast: (toast: {
    message: string;
    title: string;
    tone?: "error" | "success";
  }) => void;
}

function formState(entry: CellarEntry): CellarMemoryFormState {
  return {
    favorite: entry.favorite,
    location: entry.location ?? "",
    memoryTitle: entry.memoryTitle ?? "",
    notes: entry.notes ?? "",
    occasion: entry.occasion ?? "",
    openedWith: entry.openedWith ?? "",
    pairing: entry.pairing ?? "",
    status: entry.status,
    tags: entry.tags.join(", "),
    tastedOn: entry.tastedOn ?? "",
    userRating: entry.userRating === null ? "" : String(entry.userRating),
    wouldBuyAgain:
      entry.wouldBuyAgain === null
        ? "unanswered"
        : entry.wouldBuyAgain
          ? "yes"
          : "no",
  };
}

function isCellarStatus(value: string): value is CellarStatus {
  return Object.prototype.hasOwnProperty.call(CELLAR_STATUS_LABELS, value);
}

function parseTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function validate(form: CellarMemoryFormState): FieldErrors {
  const errors: FieldErrors = {};
  const tags = parseTags(form.tags);

  if (form.userRating) {
    const rating = Number(form.userRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.userRating = "Rating must be a whole number from 1 to 5.";
    }
  }

  if (form.memoryTitle.length > 160) {
    errors.memoryTitle = "Memory title must be 160 characters or fewer.";
  }
  if (form.location.length > 240) {
    errors.location = "Location must be 240 characters or fewer.";
  }
  if (form.pairing.length > 240) {
    errors.pairing = "Pairing must be 240 characters or fewer.";
  }
  if (form.openedWith.length > 240) {
    errors.openedWith = "Opened with must be 240 characters or fewer.";
  }
  if (form.occasion.length > 160) {
    errors.occasion = "Occasion must be 160 characters or fewer.";
  }
  if (form.notes.length > 4000) {
    errors.notes = "Notes must be 4000 characters or fewer.";
  }

  if (form.tastedOn) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.tastedOn);
    if (!match) {
      errors.tastedOn = "Tasted date must use YYYY-MM-DD.";
    } else {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      const isCalendarDate =
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() + 1 === month &&
        parsed.getUTCDate() === day;

      if (!isCalendarDate) {
        errors.tastedOn = "Enter a valid calendar date.";
      } else if (form.tastedOn > new Date().toISOString().slice(0, 10)) {
        errors.tastedOn = "Tasted date cannot be in the future.";
      }
    }
  }

  if (tags.length > 12) {
    errors.tags = "Use no more than 12 tags.";
  } else if (tags.some((tag) => tag.length > 40)) {
    errors.tags = "Each tag must be 40 characters or fewer.";
  } else if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) {
    errors.tags = "Tags must be unique, ignoring capitalization.";
  }

  return errors;
}

function nullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function changesFrom(form: CellarMemoryFormState): CellarEntryChanges {
  return {
    favorite: form.favorite,
    location: nullableTrimmed(form.location),
    memoryTitle: nullableTrimmed(form.memoryTitle),
    notes: nullableTrimmed(form.notes),
    occasion: nullableTrimmed(form.occasion),
    openedWith: nullableTrimmed(form.openedWith),
    pairing: nullableTrimmed(form.pairing),
    status: form.status,
    tags: parseTags(form.tags),
    tastedOn: nullableTrimmed(form.tastedOn),
    userRating: form.userRating ? Number(form.userRating) : null,
    wouldBuyAgain:
      form.wouldBuyAgain === "unanswered"
        ? null
        : form.wouldBuyAgain === "yes",
  };
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Could not update this bottle.";
}

export default function CellarMemoryEditor({
  entry,
  isMutating = false,
  onUpdate,
}: CellarMemoryEditorProps) {
  const { showToast } = useToast() as unknown as ToastApi;
  const [form, setForm] = useState<CellarMemoryFormState>(() => formState(entry));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState("");
  const [status, setStatus] = useState<EditorStatus>("idle");
  const isMounted = useRef(true);
  const isBusy = isMutating || status === "saving";
  const editorHeadingId = `cellar-entry-${entry.id}-editor-title`;
  const feedbackId = `cellar-entry-${entry.id}-feedback`;
  const notesDescriptionId = `cellar-entry-${entry.id}-notes-description`;
  const notesErrorId = fieldErrors.notes
    ? `cellar-entry-${entry.id}-notes-error`
    : undefined;
  const buyAgainErrorId = fieldErrors.wouldBuyAgain
    ? `cellar-entry-${entry.id}-buy-again-error`
    : undefined;

  function markChanged(field: FieldName) {
    setStatus("idle");
    setRequestError("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    const field = name as FieldName;
    const nextValue =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : value;

    setForm((current) => ({ ...current, [field]: nextValue }));
    markChanged(field);
  }

  function handleSelectChange(field: "status" | "userRating", value: string) {
    if (field === "status" && !isCellarStatus(value)) return;
    setForm((current) => ({ ...current, [field]: value }));
    markChanged(field);
  }

  function handleBuyAgainChange(value: BuyAgainChoice) {
    setForm((current) => ({ ...current, wouldBuyAgain: value }));
    markChanged("wouldBuyAgain");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    setRequestError("");

    if (Object.keys(errors).length > 0) {
      const message = "Review the highlighted tasting-memory fields.";
      showToast({ message, title: "Check the cellar entry", tone: "error" });
      return;
    }

    setStatus("saving");

    try {
      const updatedEntry = await onUpdate(entry.id, changesFrom(form));

      if (!isMounted.current) return;
      setForm(formState(updatedEntry));
      setStatus("saved");
      showToast({
        message: `${entry.wine.name} was updated.`,
        title: "Tasting memory saved",
      });
    } catch (error) {
      if (!isMounted.current) return;
      if (isAbortError(error)) {
        setStatus("idle");
        return;
      }

      const message = messageFrom(error);
      setStatus("idle");
      setRequestError(message);
      showToast({ message, title: "Update failed", tone: "error" });
    }
  }

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <form
      aria-busy={isBusy || undefined}
      aria-describedby={requestError ? feedbackId : undefined}
      aria-labelledby={editorHeadingId}
      className="gv-cellar-editor"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="gv-cellar-editor__heading">
        <p className="gv-eyebrow">Private tasting memory</p>
        <h3 id={editorHeadingId}>EDIT THE MEMORY</h3>
        <p>Your tasting memories are private to your account.</p>
      </div>

      {requestError ? (
        <p className="gv-inline-feedback gv-inline-feedback--error" id={feedbackId} role="alert">
          {requestError}
        </p>
      ) : null}
      {status === "saved" ? (
        <p className="gv-inline-feedback gv-inline-feedback--success" role="status">
          <Check aria-hidden="true" size={16} />
          Changes saved to your private cellar.
        </p>
      ) : null}

      <TextInput
        description={`${form.memoryTitle.length} of 160 characters`}
        disabled={isBusy}
        error={fieldErrors.memoryTitle}
        label="Memory title"
        maxLength={160}
        name="memoryTitle"
        onChange={handleInputChange}
        placeholder="The dinner worth remembering"
        value={form.memoryTitle}
      />

      <div className="gv-cellar-editor__grid">
        <TextInput
          disabled={isBusy}
          error={fieldErrors.tastedOn}
          label="Tasted date"
          max={new Date().toISOString().slice(0, 10)}
          name="tastedOn"
          onChange={handleInputChange}
          type="date"
          value={form.tastedOn}
        />
        <TextInput
          description={`${form.location.length} of 240 characters`}
          disabled={isBusy}
          error={fieldErrors.location}
          label="Location"
          maxLength={240}
          name="location"
          onChange={handleInputChange}
          placeholder="At home, Brooklyn"
          value={form.location}
        />
        <TextInput
          description={`${form.pairing.length} of 240 characters`}
          disabled={isBusy}
          error={fieldErrors.pairing}
          label="Pairing"
          maxLength={240}
          name="pairing"
          onChange={handleInputChange}
          placeholder="Mushroom risotto"
          value={form.pairing}
        />
        <TextInput
          description={`${form.openedWith.length} of 240 characters`}
          disabled={isBusy}
          error={fieldErrors.openedWith}
          label="Opened with"
          maxLength={240}
          name="openedWith"
          onChange={handleInputChange}
          placeholder="Friends, family, or a quiet evening"
          value={form.openedWith}
        />
        <SelectControl
          disabled={isBusy}
          error={fieldErrors.userRating}
          label="Personal rating"
          onChange={(value) => handleSelectChange("userRating", value)}
          options={RATING_OPTIONS}
          value={form.userRating}
        />
        <SelectControl
          disabled={isBusy}
          error={fieldErrors.status}
          label="Cellar status"
          onChange={(value) => handleSelectChange("status", value)}
          options={STATUS_OPTIONS}
          value={form.status}
        />
      </div>

      <TextInput
        description={`${form.occasion.length} of 160 characters`}
        disabled={isBusy}
        error={fieldErrors.occasion}
        label="Occasion"
        maxLength={160}
        name="occasion"
        onChange={handleInputChange}
        placeholder="Dinner, gift, celebration…"
        value={form.occasion}
      />

      <TextInput
        description="Separate tags with commas. Up to 12 unique tags, 40 characters each."
        disabled={isBusy}
        error={fieldErrors.tags}
        label="Tags"
        maxLength={600}
        name="tags"
        onChange={handleInputChange}
        placeholder="mineral, dinner, old world"
        value={form.tags}
      />

      <div className="gv-field">
        <label htmlFor={`cellar-entry-${entry.id}-notes`}>Private tasting note</label>
        <p className="gv-field__description" id={notesDescriptionId}>
          {form.notes.length} of 4000 characters
        </p>
        <textarea
          aria-describedby={[notesDescriptionId, notesErrorId].filter(Boolean).join(" ")}
          aria-invalid={Boolean(fieldErrors.notes) || undefined}
          disabled={isBusy}
          id={`cellar-entry-${entry.id}-notes`}
          maxLength={4000}
          name="notes"
          onChange={handleInputChange}
          placeholder="What did you taste, and what made the moment memorable?"
          rows={6}
          value={form.notes}
        />
        {fieldErrors.notes ? (
          <p className="gv-field__error" id={notesErrorId} role="alert">
            {fieldErrors.notes}
          </p>
        ) : null}
      </div>

      <fieldset
        aria-describedby={buyAgainErrorId}
        className="gv-cellar-buy-again"
        disabled={isBusy}
      >
        <legend>Would you buy this wine again?</legend>
        <p>Keep “Not answered” distinct from an explicit no.</p>
        <div>
          {([
            ["unanswered", "Not answered"],
            ["yes", "Yes"],
            ["no", "No"],
          ] as const).map(([value, label]) => (
            <label key={value}>
              <input
                checked={form.wouldBuyAgain === value}
                name="wouldBuyAgain"
                onChange={() => handleBuyAgainChange(value)}
                type="radio"
                value={value}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {fieldErrors.wouldBuyAgain ? (
          <p className="gv-field__error" id={buyAgainErrorId} role="alert">
            {fieldErrors.wouldBuyAgain}
          </p>
        ) : null}
      </fieldset>

      <label className="gv-checkbox">
        <input
          checked={form.favorite}
          disabled={isBusy}
          name="favorite"
          onChange={handleInputChange}
          type="checkbox"
        />
        <span>Mark as favorite</span>
      </label>

      <div className="gv-cellar-editor__actions">
        <Button
          busyLabel="Saving memory…"
          disabled={isBusy}
          isBusy={status === "saving"}
          type="submit"
          variant="primary"
        >
          <Save aria-hidden="true" size={17} />
          Save tasting memory
        </Button>
      </div>
    </form>
  );
}
