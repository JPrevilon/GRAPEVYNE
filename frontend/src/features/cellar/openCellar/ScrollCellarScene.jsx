import { useEffect, useRef } from "react";

import CellarShelfSection from "./CellarShelfSection.jsx";

export default function ScrollCellarScene({
  activeShelf,
  onActiveShelfChange,
  onBottleSelect,
  selectedBottleId,
  shelves,
}) {
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!sceneRef.current) {
      return undefined;
    }

    const sections = Array.from(sceneRef.current.querySelectorAll("[data-shelf-id]"));

    if (typeof IntersectionObserver === "undefined") {
      sections.forEach((section) => section.classList.add("is-revealed"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
          }
        });

        const shelfId = visibleEntry?.target?.getAttribute("data-shelf-id");

        if (shelfId) {
          onActiveShelfChange(shelfId);
        }
      },
      {
        rootMargin: "-35% 0px -45% 0px",
        threshold: [0.2, 0.45, 0.7],
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [onActiveShelfChange, shelves]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene || typeof window === "undefined") {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      scene.style.setProperty("--oc-parallax", "0px");
      scene.style.setProperty("--oc-light-shift", "50%");
      return undefined;
    }

    let animationFrame = 0;

    function updateParallax() {
      const rect = scene.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const progress = Math.min(
        1,
        Math.max(0, (viewportHeight - rect.top) / (viewportHeight + rect.height))
      );
      const parallaxOffset = (progress - 0.5) * 54;

      scene.style.setProperty("--oc-parallax", `${parallaxOffset.toFixed(2)}px`);
      scene.style.setProperty("--oc-light-shift", `${(progress * 100).toFixed(2)}%`);
    }

    function requestUpdate() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateParallax);
    }

    updateParallax();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <section className="oc-scene" ref={sceneRef}>
      <div className="oc-scene__backdrop" aria-hidden="true">
        <span className="oc-scene__shelf oc-scene__shelf--one" />
        <span className="oc-scene__shelf oc-scene__shelf--two" />
        <span className="oc-scene__shelf oc-scene__shelf--three" />
      </div>

      <div className="oc-scene__intro">
        <p className="eyebrow">Below the house</p>
        <h2>Scroll into the cellar.</h2>
        <p>
          Each shelf is arranged by intent, so the next bottle feels found
          instead of filtered.
        </p>
      </div>

      <div className="oc-shelves">
        {shelves.map((shelf) => (
          <CellarShelfSection
            activeShelf={activeShelf}
            key={shelf.id}
            onBottleSelect={onBottleSelect}
            selectedBottleId={selectedBottleId}
            shelf={shelf}
          />
        ))}
      </div>
    </section>
  );
}
