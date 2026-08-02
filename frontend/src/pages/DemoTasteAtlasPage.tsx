import PageHeader from "@/components/ui/PageHeader";
import { demoCellarBottles, demoCellarSections } from "@/data/demoCellar";
import { Link } from "react-router-dom";

function countValues(values: string[]) {
  return [...new Set(values)].map((value) => ({
    count: values.filter((candidate) => candidate === value).length,
    value,
  })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const favoriteCount = demoCellarBottles.filter((bottle) => bottle.favorite).length;
const varietals = countValues(demoCellarBottles.map((bottle) => bottle.varietal));
const regions = countValues(demoCellarBottles.map((bottle) => bottle.region));
const occasions = countValues(demoCellarBottles.map((bottle) => bottle.occasion));

export default function DemoTasteAtlasPage() {
  return (
    <div className="content-stack demo-page" data-demo-surface="taste-atlas">
      <section className="demo-notice" aria-labelledby="demo-atlas-title">
        <p className="eyebrow">Public demonstration · Read-only</p>
        <h1 id="demo-atlas-title">Taste Atlas from fictional cellar data</h1>
        <p>
          This illustrative summary is derived only from the same 11 demo bottles.
          It is not a personal profile and never reads or writes account data.
        </p>
        <Link className="text-link" to="/demo/cellar">
          Return to the demo cellar
        </Link>
      </section>

      <PageHeader
        eyebrow="Demo Taste Atlas"
        headingLevel="h2"
        title="A transparent view of the fixture collection"
        description={`${demoCellarBottles.length} fictional bottles across ${demoCellarSections.length} curated shelves.`}
      />

      <div className="demo-atlas-grid">
        <section className="tool-surface" aria-labelledby="atlas-varietals">
          <span className="eyebrow">Varietals</span>
          <h2 id="atlas-varietals">What appears in the demo</h2>
          <div className="tag-list">
            {varietals.map(({ count, value }) => <span key={value}>{value} · {count}</span>)}
          </div>
        </section>

        <section className="tool-surface" aria-labelledby="atlas-regions">
          <span className="eyebrow">Regions</span>
          <h2 id="atlas-regions">Places represented</h2>
          <div className="tag-list">
            {regions.map(({ count, value }) => <span key={value}>{value} · {count}</span>)}
          </div>
        </section>

        <section className="tool-surface" aria-labelledby="atlas-occasions">
          <span className="eyebrow">Occasions</span>
          <h2 id="atlas-occasions">Recorded demo moments</h2>
          <div className="tag-list">
            {occasions.map(({ count, value }) => <span key={value}>{value} · {count}</span>)}
          </div>
        </section>

        <section className="tool-surface" aria-labelledby="atlas-favorites">
          <span className="eyebrow">Fixture summary</span>
          <h2 id="atlas-favorites">{favoriteCount} marked favorites</h2>
          <p>
            This count reflects the curated fixture flags only. It does not predict
            or represent a visitor&apos;s taste.
          </p>
        </section>
      </div>
    </div>
  );
}
