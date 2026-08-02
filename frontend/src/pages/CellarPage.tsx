import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Wine } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  deleteCellarEntry,
  getCellarEntries,
  type CellarEntryChanges,
  updateCellarEntry,
} from "@/api/cellar";
import CellarDetailPanel from "@/features/cellar/components/CellarDetailPanel.jsx";
import CellarShelf from "@/features/cellar/components/CellarShelf.jsx";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import { useAuth } from "@/features/auth/useAuth";
import type { CellarListResult } from "@/types/domain";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Your cellar could not be loaded.";
}

export default function CellarPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const userId = user?.id;
  const queryKey = privateQueryKey(userId ?? 0, "cellar");

  const cellarQuery = useQuery({
    enabled: userId !== undefined,
    gcTime: 0,
    queryFn: ({ signal }) => getCellarEntries(signal),
    queryKey,
    staleTime: 0,
  });

  const updateMutation = useMutation({
    gcTime: 0,
    mutationKey: privateQueryKey(userId ?? 0, "cellar", "update"),
    mutationFn: ({ changes, entryId }: { changes: CellarEntryChanges; entryId: number }) =>
      updateCellarEntry(entryId, changes),
    onSuccess: (updatedEntry) => {
      queryClient.setQueryData<CellarListResult>(queryKey, (current) =>
        current
          ? {
              ...current,
              entries: current.entries.map((entry) =>
                entry.id === updatedEntry.id ? updatedEntry : entry,
              ),
            }
          : current,
      );
    },
  });

  const deleteMutation = useMutation({
    gcTime: 0,
    mutationKey: privateQueryKey(userId ?? 0, "cellar", "delete"),
    mutationFn: (entryId: number) => deleteCellarEntry(entryId),
    onSuccess: (deletedId) => {
      queryClient.setQueryData<CellarListResult>(queryKey, (current) =>
        current
          ? {
              count: Math.max(0, current.count - 1),
              entries: current.entries.filter((entry) => entry.id !== deletedId),
            }
          : current,
      );
      setSelectedEntryId(null);
    },
  });

  const entries = useMemo(
    () =>
      [...(cellarQuery.data?.entries ?? [])].sort(
        (left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt),
      ),
    [cellarQuery.data?.entries],
  );
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? null;

  async function handleUpdate(entryId: number, changes: CellarEntryChanges) {
    await updateMutation.mutateAsync({ changes, entryId });
  }

  async function handleDelete(entryId: number) {
    await deleteMutation.mutateAsync(entryId);
  }

  if (cellarQuery.isPending) {
    return (
      <section className="state-panel" aria-live="polite" role="status">
        <Wine aria-hidden="true" size={30} />
        <p className="eyebrow">Private cellar</p>
        <h1>Opening your saved bottles.</h1>
        <p>Loading only the cellar entries attached to this signed-in session.</p>
      </section>
    );
  }

  if (cellarQuery.isError) {
    return (
      <section className="state-panel" role="alert">
        <AlertCircle aria-hidden="true" size={30} />
        <p className="eyebrow">Private cellar</p>
        <h1>Your saved cellar is unavailable.</h1>
        <p>{errorMessage(cellarQuery.error)}</p>
        <p>No demonstration bottles have been substituted and no saved data changed.</p>
        <button
          className="secondary-button state-panel__action"
          onClick={() => void cellarQuery.refetch()}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="state-panel">
        <Wine aria-hidden="true" size={30} />
        <p className="eyebrow">Private cellar · Live account data</p>
        <h1>Your cellar is ready for its first bottle.</h1>
        <p>Wines saved from discovery will appear here after the API confirms them.</p>
        <Link className="primary-button state-panel__action" to="/discover">
          Discover a wine
        </Link>
      </section>
    );
  }

  return (
    <div className="content-stack live-cellar-page" data-cellar-source="authenticated-api">
      <header className="page-header">
        <div className="page-header__content">
          <div>
            <p className="eyebrow">Private cellar · Live account data</p>
            <h1>Your saved bottles</h1>
          </div>
          <p>
            This protected list comes from the authenticated Flask cellar API.
            Select a bottle to update its persisted notes or remove it.
          </p>
        </div>
      </header>

      <div className="open-cellar-experience">
        <div className="open-cellar-stage">
          <section className="open-cellar-stage__intro">
            <p className="eyebrow">{entries.length} saved {entries.length === 1 ? "entry" : "entries"}</p>
            <h2>Account cellar</h2>
            <p>
              Bottles remain in their backend-provided status. This foundation does
              not infer pairings, occasions, rarity, or taste claims.
            </p>
          </section>
          <div className="open-cellar-shelves">
            <CellarShelf
              entries={entries}
              eyebrow="Newest saves first"
              onSelect={(entry: { id: number }) => setSelectedEntryId(entry.id)}
              selectedEntryId={selectedEntryId}
              title="All cellar entries"
            />
          </div>
        </div>

        <CellarDetailPanel
          entry={selectedEntry}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      </div>
    </div>
  );
}
