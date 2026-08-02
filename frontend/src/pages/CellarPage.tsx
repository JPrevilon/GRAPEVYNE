import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import {
  deleteCellarEntry,
  getCellarEntries,
  type CellarEntryChanges,
  updateCellarEntry,
} from "@/api/cellar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormControls";
import { PageShell } from "@/components/ui/PageShell";
import {
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  NoticePanel,
} from "@/components/ui/StatePanels";
import CellarDetailPanel from "@/features/cellar/components/CellarDetailPanel";
import CellarShelf from "@/features/cellar/components/CellarShelf";
import { cellarEntryTriggerId } from "@/features/cellar/components/cellarPresentation";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import { useAuth } from "@/features/auth/useAuth";
import type { CellarEntry, CellarListResult } from "@/types/domain";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Your cellar could not be loaded.";
}

function searchableWineFields(entry: CellarEntry) {
  return [
    entry.wine.name,
    entry.wine.winery,
    entry.wine.varietal,
    entry.wine.region,
    entry.wine.country,
    entry.wine.vintage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function repeatedWineCount(entries: CellarEntry[]) {
  const seenWineIds = new Set<number>();

  return entries.reduce((count, entry) => {
    if (seenWineIds.has(entry.wineId)) {
      return count + 1;
    }

    seenWineIds.add(entry.wineId);
    return count;
  }, 0);
}

export default function CellarPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleEntries = useMemo(
    () =>
      normalizedSearch
        ? entries.filter((entry) => searchableWineFields(entry).includes(normalizedSearch))
        : entries,
    [entries, normalizedSearch],
  );
  const duplicateCount = useMemo(() => repeatedWineCount(entries), [entries]);
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const isMutating = updateMutation.isPending || deleteMutation.isPending;

  function handleUpdate(entryId: number, changes: CellarEntryChanges) {
    return updateMutation.mutateAsync({ changes, entryId });
  }

  function handleDelete(entryId: number) {
    return deleteMutation.mutateAsync(entryId);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setSelectedEntryId(null);
  }

  function handleClosePanel() {
    const triggerId =
      selectedEntryId === null ? null : cellarEntryTriggerId(selectedEntryId);
    setSelectedEntryId(null);

    if (triggerId) {
      window.requestAnimationFrame(() => {
        document.getElementById(triggerId)?.focus();
      });
    }
  }

  if (cellarQuery.isPending) {
    return (
      <div className="gv-page-shell gv-cellar-page" data-cellar-source="authenticated-api">
        <LoadingPanel
          description="Loading only the cellar entries owned by this signed-in session."
          eyebrow="Private cellar"
          headingLevel="h1"
          title="Opening your saved bottles."
        />
      </div>
    );
  }

  if (cellarQuery.isError) {
    return (
      <div className="gv-page-shell gv-cellar-page" data-cellar-source="authenticated-api">
        <ErrorPanel
          action={
            <Button
              busyLabel="Trying again…"
              isBusy={cellarQuery.isFetching}
              onClick={() => void cellarQuery.refetch()}
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" size={17} />
              Try again
            </Button>
          }
          description={errorMessage(cellarQuery.error)}
          eyebrow="Private cellar · No demo fallback"
          headingLevel="h1"
          title="Your saved cellar is unavailable."
        >
          <p>No demonstration bottles have been substituted and no saved data changed.</p>
        </ErrorPanel>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="gv-page-shell gv-cellar-page" data-cellar-source="authenticated-api">
        <EmptyState
          action={
            <ButtonLink to="/discover" variant="primary">
              Discover a wine
            </ButtonLink>
          }
          description="Wines will appear here only after the cellar API confirms a save for this account."
          eyebrow="Private cellar · Live account data"
          headingLevel="h1"
          title="Your cellar is ready for its first bottle."
        />
      </div>
    );
  }

  return (
    <PageShell
      className="gv-cellar-page"
      description="Review the bottles returned by your authenticated cellar, then edit only the private fields you choose."
      eyebrow="Private cellar · Live account data"
      title="Your saved bottles"
    >
      <div data-cellar-source="authenticated-api">
        {cellarQuery.isFetching ? (
          <NoticePanel
            description="The current list remains visible while the private cellar is refreshed."
            eyebrow="Refreshing"
            title="Checking for current cellar data."
          />
        ) : null}

        {duplicateCount > 0 ? (
          <NoticePanel
            description={`${duplicateCount} repeated ${duplicateCount === 1 ? "entry was" : "entries were"} returned with an existing wine ID. Every API entry remains visible and none were merged.`}
            eyebrow="Cellar integrity notice"
            title="Repeated saved-wine records were received."
          />
        ) : null}

        <section aria-label="Search saved bottles" className="gv-cellar-toolbar">
          <TextInput
            autoComplete="off"
            className="gv-cellar-toolbar__search"
            label="Search your cellar"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Wine, producer, varietal, or region"
            type="search"
            value={searchQuery}
          />
          <p aria-live="polite" className="gv-cellar-toolbar__result-count" role="status">
            Showing {visibleEntries.length} of {entries.length} saved {entries.length === 1 ? "bottle" : "bottles"}.
          </p>
        </section>

        {visibleEntries.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={() => handleSearchChange("")} variant="secondary">
                Clear search
              </Button>
            }
            description="No API entry contains that wine, producer, varietal, or place."
            eyebrow="Cellar search"
            title="No saved bottle matches this search."
          />
        ) : (
          <div className="gv-cellar-layout">
            <CellarShelf
              disabled={isMutating}
              entries={visibleEntries}
              onSelect={(entry) => setSelectedEntryId(entry.id)}
              selectedEntryId={selectedEntryId}
            />
            <CellarDetailPanel
              entry={selectedEntry}
              isMutating={isMutating}
              onClose={handleClosePanel}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
