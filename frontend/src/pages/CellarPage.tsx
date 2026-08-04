import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  assertCellarEntryOwner,
  assertCellarListOwner,
  deleteCellarEntry,
  getCellarEntries,
  isCellarIdentityMismatch,
  type CellarEntryChanges,
  updateCellarEntry,
} from "@/api/cellar";
import { isAbortError, isAuthenticationRequired } from "@/api/client";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { DIRECTORY_PAGE_HEADINGS } from "@/components/typography/directoryHeadingPresets";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FilterChip, SelectControl, TextInput } from "@/components/ui/FormControls";
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
import { invalidatePrivateCellarDerivations } from "@/features/cellar/cellarMutationInvalidation";
import {
  buildCellarGroups,
  type CellarGroupId,
  type CellarSortId,
  type CellarViewMode,
  sortCellarEntries,
} from "@/features/cellar/cellarOrganization";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import { useAuth } from "@/features/auth/useAuth";
import type { CellarEntry, CellarListResult } from "@/types/domain";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Your cellar could not be loaded.";
}

function staleCellarOperationError() {
  return new DOMException(
    "The cellar request was superseded by a session check.",
    "AbortError",
  );
}

function searchableWineFields(entry: CellarEntry) {
  return [
    entry.wine.name,
    entry.wine.winery,
    entry.wine.varietal,
    entry.wine.region,
    entry.wine.country,
    entry.wine.vintage,
    entry.memoryTitle,
    entry.location,
    entry.pairing,
    entry.openedWith,
    entry.notes,
    ...entry.tags,
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

function CellarHeading() {
  return <DirectoryHeading {...DIRECTORY_PAGE_HEADINGS.cellar} />;
}

export default function CellarPage() {
  const { handleAuthenticationRequired, status: authStatus, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupId, setGroupId] = useState<CellarGroupId>("all");
  const [sortId, setSortId] = useState<CellarSortId>("recent");
  const [viewMode, setViewMode] = useState<CellarViewMode>("list");
  const userId = user?.id;
  const activeUserId = useRef(userId);
  const activeAuthStatus = useRef(authStatus);
  const isMounted = useRef(false);
  const queryKey = privateQueryKey(userId ?? 0, "cellar");

  activeAuthStatus.current = authStatus;
  activeUserId.current = userId;

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const cellarQuery = useQuery({
    enabled: userId !== undefined,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      if (userId === undefined) {
        throw new Error("An authenticated session is required.");
      }

      return assertCellarListOwner(
        await getCellarEntries(signal),
        userId,
      );
    },
    queryKey,
    staleTime: 0,
  });

  useEffect(() => {
    if (
      userId !== undefined &&
      (isAuthenticationRequired(cellarQuery.error) ||
        isCellarIdentityMismatch(cellarQuery.error))
    ) {
      void handleAuthenticationRequired(userId);
    }
  }, [cellarQuery.error, handleAuthenticationRequired, userId]);

  const updateMutation = useMutation({
    gcTime: 0,
    mutationKey: privateQueryKey(userId ?? 0, "cellar", "update"),
    mutationFn: async ({ changes, entryId, ownerId }: { changes: CellarEntryChanges; entryId: number; ownerId: number }) =>
      assertCellarEntryOwner(
        await updateCellarEntry(entryId, changes, ownerId),
        ownerId,
      ),
    onError: (error, { ownerId }) => {
      if (!isMounted.current || isAbortError(error)) {
        return;
      }

      if (
        isAuthenticationRequired(error) ||
        isCellarIdentityMismatch(error)
      ) {
        void handleAuthenticationRequired(ownerId);
      }
    },
    onSuccess: (updatedEntry, { ownerId }) => {
      if (!isMounted.current || activeUserId.current !== ownerId) {
        return;
      }

      queryClient.setQueryData<CellarListResult>(
        privateQueryKey(ownerId, "cellar"),
        (current) =>
        current
          ? {
              ...current,
              entries: current.entries.map((entry) =>
                entry.id === updatedEntry.id ? updatedEntry : entry,
              ),
            }
          : current,
      );
      void invalidatePrivateCellarDerivations(queryClient, ownerId);
    },
  });

  const deleteMutation = useMutation({
    gcTime: 0,
    mutationKey: privateQueryKey(userId ?? 0, "cellar", "delete"),
    mutationFn: ({ entryId, ownerId }: { entryId: number; ownerId: number }) =>
      deleteCellarEntry(entryId, ownerId),
    onError: (error, { ownerId }) => {
      if (!isMounted.current || isAbortError(error)) {
        return;
      }

      if (
        isAuthenticationRequired(error) ||
        isCellarIdentityMismatch(error)
      ) {
        void handleAuthenticationRequired(ownerId);
      }
    },
    onSuccess: (deletedId, { ownerId }) => {
      if (!isMounted.current || activeUserId.current !== ownerId) {
        return;
      }

      queryClient.setQueryData<CellarListResult>(
        privateQueryKey(ownerId, "cellar"),
        (current) =>
        current
          ? {
              count: Math.max(0, current.count - 1),
              entries: current.entries.filter((entry) => entry.id !== deletedId),
            }
          : current,
      );
      void invalidatePrivateCellarDerivations(queryClient, ownerId);
      setSelectedEntryId((current) => current === deletedId ? null : current);
    },
  });

  useEffect(() => {
    setSelectedEntryId(null);
    setSearchQuery("");
    setGroupId("all");
    setSortId("recent");
    setViewMode("list");
  }, [userId]);

  const entries = useMemo(
    () =>
      [...(cellarQuery.data?.entries ?? [])].sort(
        (left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt),
      ),
    [cellarQuery.data?.entries],
  );
  const groups = useMemo(() => buildCellarGroups(entries), [entries]);
  const activeGroup = groups.find((group) => group.id === groupId) ?? groups[0];
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleEntries = useMemo(
    () => {
      const groupedEntries = activeGroup?.entries ?? [];
      const searchedEntries = normalizedSearch
        ? groupedEntries.filter((entry) =>
            searchableWineFields(entry).includes(normalizedSearch),
          )
        : groupedEntries;

      return sortCellarEntries(searchedEntries, sortId);
    },
    [activeGroup, normalizedSearch, sortId],
  );
  const duplicateCount = useMemo(() => repeatedWineCount(entries), [entries]);
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const selectedEntryIsMutating =
    authStatus !== "ready" ||
    (updateMutation.isPending &&
      updateMutation.variables?.entryId === selectedEntryId) ||
    (deleteMutation.isPending &&
      deleteMutation.variables?.entryId === selectedEntryId);

  async function handleUpdate(entryId: number, changes: CellarEntryChanges) {
    if (userId === undefined) {
      return Promise.reject(new Error("An authenticated session is required."));
    }

    const ownerId = userId;

    try {
      const updatedEntry = await updateMutation.mutateAsync({
        changes,
        entryId,
        ownerId,
      });

      if (
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== ownerId
      ) {
        throw staleCellarOperationError();
      }

      return updatedEntry;
    } catch (error) {
      if (
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== ownerId ||
        isAbortError(error) ||
        isAuthenticationRequired(error) ||
        isCellarIdentityMismatch(error)
      ) {
        throw staleCellarOperationError();
      }

      throw error;
    }
  }

  async function handleDelete(entryId: number) {
    if (userId === undefined) {
      return Promise.reject(new Error("An authenticated session is required."));
    }

    const ownerId = userId;

    try {
      const deletedId = await deleteMutation.mutateAsync({ entryId, ownerId });

      if (
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== ownerId
      ) {
        throw staleCellarOperationError();
      }

      return deletedId;
    } catch (error) {
      if (
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== ownerId ||
        isAbortError(error) ||
        isAuthenticationRequired(error) ||
        isCellarIdentityMismatch(error)
      ) {
        throw staleCellarOperationError();
      }

      throw error;
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setSelectedEntryId(null);
  }

  function handleGroupChange(nextGroupId: CellarGroupId) {
    setGroupId(nextGroupId);
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
      <PageShell
        className="gv-cellar-page"
        description="Loading only the cellar entries owned by this signed-in session."
        eyebrow="02 / PRIVATE DIRECTORY"
        heading={<CellarHeading />}
      >
        <div data-cellar-source="authenticated-api">
          <LoadingPanel
            description="Loading only the cellar entries owned by this signed-in session."
            eyebrow="Private cellar"
            title="OPENING YOUR SAVED BOTTLES"
          />
        </div>
      </PageShell>
    );
  }

  if (cellarQuery.isError) {
    return (
      <PageShell
        className="gv-cellar-page"
        description="The private cellar service did not return this account’s saved entries."
        eyebrow="02 / PRIVATE DIRECTORY"
        heading={<CellarHeading />}
      >
        <div data-cellar-source="authenticated-api">
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
            title="YOUR SAVED CELLAR IS UNAVAILABLE"
          >
            <p>No demonstration bottles have been substituted and no saved data changed.</p>
          </ErrorPanel>
        </div>
      </PageShell>
    );
  }

  if (entries.length === 0) {
    return (
      <PageShell
        className="gv-cellar-page"
        description="Build a private archive from bottles confirmed by the authenticated cellar API."
        eyebrow="02 / PRIVATE DIRECTORY"
        heading={<CellarHeading />}
      >
        <div data-cellar-source="authenticated-api">
          <EmptyState
            action={
              <ButtonLink to="/discover" variant="primary">
                Discover a wine
              </ButtonLink>
            }
            description="Wines will appear here only after the cellar API confirms a save for this account."
            eyebrow="Private cellar · Live account data"
            title="YOUR CELLAR IS READY FOR ITS FIRST BOTTLE"
          >
            <p>Your tasting memories are private to your account.</p>
          </EmptyState>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      className="gv-cellar-page"
      description="Review the bottles returned by your authenticated cellar, then edit only the private fields you choose."
      eyebrow="02 / PRIVATE DIRECTORY / LIVE ACCOUNT DATA"
      heading={<CellarHeading />}
    >
      <div data-cellar-source="authenticated-api">
        {cellarQuery.isFetching ? (
          <NoticePanel
            description="The current list remains visible while the private cellar is refreshed."
            eyebrow="Refreshing"
            title="CHECKING FOR CURRENT CELLAR DATA"
          />
        ) : null}

        {duplicateCount > 0 ? (
          <NoticePanel
            description={`${duplicateCount} repeated ${duplicateCount === 1 ? "entry was" : "entries were"} returned with an existing wine ID. Every API entry remains visible and none were merged.`}
            eyebrow="Cellar integrity notice"
            title="REPEATED SAVED-WINE RECORDS WERE RECEIVED"
          />
        ) : null}

        <p className="gv-cellar-privacy">
          Your tasting memories are private to your account.
        </p>

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
            Showing {visibleEntries.length} of {activeGroup?.entries.length ?? 0} in {activeGroup?.label ?? "All bottles"}; {entries.length} total.
          </p>
        </section>

        <section aria-labelledby="cellar-organization-title" className="gv-cellar-organization">
          <div>
            <p className="gv-eyebrow">Cellar organization</p>
            <h2 id="cellar-organization-title">PERSISTED GROUPS</h2>
            <p>Only groups supported by your saved fields appear here.</p>
          </div>
          <div
            aria-label="Choose a cellar group"
            className="gv-cellar-group-filters"
            role="group"
          >
            {groups.map((group) => (
              <FilterChip
                active={activeGroup?.id === group.id}
                key={group.id}
                onClick={() => handleGroupChange(group.id)}
              >
                {group.label} · {group.entries.length}
              </FilterChip>
            ))}
          </div>
          <div className="gv-cellar-view-controls">
            <SelectControl
              label="Sort bottles"
              onChange={(value) => setSortId(value as CellarSortId)}
              options={[
                { label: "Recently added", value: "recent" },
                { label: "Highest rated", value: "rating" },
                { label: "Recently tasted", value: "tasted" },
                { label: "Wine name", value: "wine-name" },
              ]}
              value={sortId}
            />
            <div aria-label="Bottle display" role="group">
              <Button
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                size="compact"
                variant={viewMode === "list" ? "secondary" : "text"}
              >
                List
              </Button>
              <Button
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                size="compact"
                variant={viewMode === "grid" ? "secondary" : "text"}
              >
                Grid
              </Button>
            </div>
          </div>
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
            title="NO SAVED BOTTLE MATCHES THIS SEARCH"
          />
        ) : (
          <div className="gv-cellar-layout">
            <CellarShelf
              disabled={authStatus !== "ready"}
              entries={visibleEntries}
              groupLabel={activeGroup?.label}
              onSelect={(entry) => setSelectedEntryId(entry.id)}
              selectedEntryId={selectedEntryId}
              viewMode={viewMode}
            />
            <CellarDetailPanel
              entry={selectedEntry}
              isMutating={selectedEntryIsMutating}
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
