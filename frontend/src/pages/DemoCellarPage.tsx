import { ArrowRight, LockKeyhole, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormControls";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import { SidePanel } from "@/components/ui/SidePanel";
import { EmptyState, NoticePanel } from "@/components/ui/StatePanels";
import { WineBottleFallback } from "@/components/wine/WineBottleFallback";
import { getBottleTone } from "@/components/wine/bottleTone";
import {
  demoCellarSections,
  searchDemoCellar,
  type DemoBottle,
} from "@/data/demoCellar";

export default function DemoCellarPage() {
  const [query, setQuery] = useState("");
  const [selectedBottle, setSelectedBottle] = useState<DemoBottle | null>(null);
  const visibleIds = useMemo(
    () => new Set(searchDemoCellar(query).map((bottle) => bottle.cellarEntryId)),
    [query],
  );
  const visibleCount = visibleIds.size;

  return (
    <PageShell
      className="gv-demo-page gv-demo-cellar"
      description="Browse eleven illustrative bottles without signing in. Nothing on this page reads or changes a visitor’s cellar."
      eyebrow="Public demonstration · Read-only"
      title={<>A cellar designed around <em>the moments bottles join.</em></>}
    >
      <NoticePanel
        action={
          <div className="gv-action-row">
            <ButtonLink to="/signup" variant="primary">Create an account</ButtonLink>
            <ButtonLink to="/login" variant="ghost">Sign in</ButtonLink>
            <ButtonLink to="/discover" variant="text">
              Begin real discovery <ArrowRight aria-hidden="true" size={16} />
            </ButtonLink>
          </div>
        }
        description="Every bottle, rating, note, pairing, and occasion below belongs to a curated fictional fixture. There are no save, favorite, edit, rating, or delete actions."
        eyebrow="Demo boundary"
        title="Visible fiction, never private account data."
        tone="demo"
      />

      <section aria-labelledby="demo-collection-title" className="gv-demo-cellar__collection">
        <SectionHeading
          actions={
            <ButtonLink to="/demo/taste-atlas" variant="secondary">
              View demo Taste Atlas
            </ButtonLink>
          }
          description={`${visibleCount} of 11 fictional bottles shown.`}
          eyebrow="The demonstration collection"
          id="demo-collection-title"
          title="Five shelves, one transparent fixture."
        />

        <div className="gv-demo-cellar__search">
          <Search aria-hidden="true" size={19} />
          <TextInput
            label="Search the fictional collection"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bottle, varietal, region, occasion…"
            type="search"
            value={query}
          />
        </div>

        {visibleCount === 0 ? (
          <EmptyState
            action={<Button onClick={() => setQuery("")} variant="secondary">Clear search</Button>}
            description="Try another bottle, varietal, region, pairing, or occasion."
            title="No fictional bottle matches that search."
          />
        ) : (
          <div className="gv-demo-shelves">
            {demoCellarSections.map((section) => {
              const bottles = section.bottles.filter((bottle) => visibleIds.has(bottle.cellarEntryId));

              if (bottles.length === 0) return null;

              return (
                <section className="gv-demo-shelf" key={section.sectionId}>
                  <header>
                    <div>
                      <p className="gv-eyebrow">{section.theme}</p>
                      <h3>{section.sectionName}</h3>
                      <p>{section.description}</p>
                    </div>
                    <span>{bottles.length} {bottles.length === 1 ? "bottle" : "bottles"}</span>
                  </header>
                  <div className="gv-demo-shelf__rail">
                    {bottles.map((bottle) => (
                      <button
                        aria-controls="demo-bottle-detail"
                        aria-pressed={selectedBottle?.cellarEntryId === bottle.cellarEntryId}
                        className="gv-demo-bottle"
                        key={bottle.cellarEntryId}
                        onClick={() => setSelectedBottle(bottle)}
                        type="button"
                      >
                        <WineBottleFallback
                          label={bottle.name}
                          tone={getBottleTone(bottle.varietal)}
                        />
                        <span>
                          <small>{bottle.varietal} · {bottle.vintage}</small>
                          <strong>{bottle.name}</strong>
                          <span>{bottle.producer}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <SidePanel className="gv-demo-detail" id="demo-bottle-detail" labelledBy="demo-detail-title">
        {selectedBottle ? (
          <>
            <div className="gv-demo-detail__topline">
              <span><LockKeyhole aria-hidden="true" size={15} />Read-only demo detail</span>
              <Button
                aria-label="Close bottle details"
                onClick={() => setSelectedBottle(null)}
                size="compact"
                variant="text"
              >
                <X aria-hidden="true" size={16} />Close
              </Button>
            </div>
            <div className="gv-demo-detail__hero">
              <WineBottleFallback
                label={selectedBottle.name}
                tone={getBottleTone(selectedBottle.varietal)}
              />
              <div>
                <p className="gv-eyebrow">{selectedBottle.varietal} · {selectedBottle.vintage}</p>
                <h2 id="demo-detail-title">{selectedBottle.name}</h2>
                <p>{selectedBottle.producer}</p>
              </div>
            </div>
            <dl className="gv-demo-detail__facts">
              <div><dt>Region</dt><dd>{selectedBottle.region}, {selectedBottle.country}</dd></div>
              <div><dt>Fixture rating</dt><dd>{selectedBottle.rating}/5</dd></div>
              <div><dt>Fixture occasion</dt><dd>{selectedBottle.occasion}</dd></div>
            </dl>
            <p>{selectedBottle.notes}</p>
            <div className="gv-tag-list">
              {selectedBottle.pairings.map((pairing) => <span key={pairing}>{pairing}</span>)}
            </div>
            <p className="gv-demo-detail__disclosure">
              This illustrative note and rating are not associated with you and cannot be edited here.
            </p>
          </>
        ) : (
          <div className="gv-demo-detail__empty">
            <LockKeyhole aria-hidden="true" size={24} />
            <h2 id="demo-detail-title">Select a fictional bottle</h2>
            <p>Open any bottle card to read its clearly labeled demonstration details.</p>
          </div>
        )}
      </SidePanel>
    </PageShell>
  );
}
