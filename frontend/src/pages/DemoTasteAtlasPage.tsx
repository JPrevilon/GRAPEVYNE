import { ArrowRight, Compass, Grape, Map as MapIcon, Sparkles } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import { NoticePanel } from "@/components/ui/StatePanels";
import { demoCellarBottles, demoCellarSections } from "@/data/demoCellar";

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([value, count]) => ({ count, value }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

const favoriteCount = demoCellarBottles.filter((bottle) => bottle.favorite).length;
const varietals = countValues(demoCellarBottles.map((bottle) => bottle.varietal));
const regions = countValues(demoCellarBottles.map((bottle) => bottle.region));
const occasions = countValues(demoCellarBottles.map((bottle) => bottle.occasion));

const atlasGroups = [
  { icon: Grape, items: varietals, label: "Varietals", title: "WHAT APPEARS IN THE DEMO" },
  { icon: MapIcon, items: regions, label: "Regions", title: "PLACES REPRESENTED" },
  { icon: Compass, items: occasions, label: "Occasions", title: "RECORDED DEMO MOMENTS" },
] as const;

export default function DemoTasteAtlasPage() {
  return (
    <PageShell
      className="gv-demo-page gv-demo-atlas"
      description="A transparent summary derived only from the eleven fictional bottles in the public demonstration cellar."
      eyebrow="Public demonstration · Read-only"
      title="DEMO TASTE ATLAS"
    >
      <NoticePanel
        action={
          <div className="gv-action-row">
            <ButtonLink to="/demo/cellar" variant="secondary">Return to demo cellar</ButtonLink>
            <ButtonLink to="/signup" variant="primary">Create an account</ButtonLink>
            <ButtonLink to="/login" variant="ghost">Sign in</ButtonLink>
            <ButtonLink to="/discover" variant="text">
              Begin real discovery <ArrowRight aria-hidden="true" size={16} />
            </ButtonLink>
          </div>
        }
        description="This page does not query a profile endpoint, predict your taste, or read authenticated cellar data. Full personal Taste Atlas computation remains a later engine phase."
        eyebrow="Demo boundary"
        title="ILLUSTRATIVE PATTERNS—NOT A VISITOR PROFILE"
        tone="demo"
      />

      <section aria-labelledby="atlas-summary-title" className="gv-demo-atlas__summary">
        <SectionHeading
          description={`${demoCellarBottles.length} fictional bottles across ${demoCellarSections.length} curated shelves.`}
          eyebrow="Fixture summary"
          id="atlas-summary-title"
          title="A SMALL COLLECTION, SHOWN HONESTLY"
        />
        <div
          aria-label="Demonstration collection overview"
          className="gv-demo-atlas__constellation"
          role="group"
        >
          <span aria-hidden="true" className="gv-demo-atlas__orbit gv-demo-atlas__orbit--one" />
          <span aria-hidden="true" className="gv-demo-atlas__orbit gv-demo-atlas__orbit--two" />
          <div><Sparkles aria-hidden="true" size={22} /><strong>{favoriteCount}</strong><span>fixture favorites</span></div>
          <div><Grape aria-hidden="true" size={22} /><strong>{varietals.length}</strong><span>varietals</span></div>
          <div><MapIcon aria-hidden="true" size={22} /><strong>{regions.length}</strong><span>regions</span></div>
        </div>
      </section>

      <div className="gv-demo-atlas__grid">
        {atlasGroups.map(({ icon: Icon, items, label, title }) => (
          <section className="gv-atlas-card" key={label}>
            <Icon aria-hidden="true" size={22} />
            <p className="gv-eyebrow">{label}</p>
            <h2>{title}</h2>
            <div className="gv-tag-list">
              {items.map(({ count, value }) => <span key={value}>{value} · {count}</span>)}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
