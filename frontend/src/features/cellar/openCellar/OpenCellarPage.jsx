import { useMemo, useRef, useState } from "react";

import BottleDetailPanel from "./BottleDetailPanel.jsx";
import CellarControls from "./CellarControls.jsx";
import CellarIntro from "./CellarIntro.jsx";
import CellarScene from "./CellarScene.jsx";
import EmptyCellarState from "./EmptyCellarState.jsx";
import { mockCellarSections } from "./interactiveCellarData.js";

export default function OpenCellarPage() {
  const [sections, setSections] = useState(mockCellarSections);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [hoveredSectionId, setHoveredSectionId] = useState(null);
  const [selectedBottleId, setSelectedBottleId] = useState(null);
  const [hoveredBottleId, setHoveredBottleId] = useState(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const sceneRef = useRef(null);
  const selectedBottleTriggerRef = useRef(null);

  const bottles = useMemo(
    () => sections.flatMap((section) => section.bottles),
    [sections]
  );
  const selectedBottle =
    bottles.find((bottle) => bottle.cellarEntryId === selectedBottleId) || null;
  const activeSection =
    sections.find((section) => section.sectionId === activeSectionId) || null;

  function scrollToScene() {
    sceneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSectionSelect(sectionId) {
    setActiveSectionId(sectionId);
    setSelectedBottleId(null);
    setIsDetailPanelOpen(false);
    selectedBottleTriggerRef.current = null;
    scrollToScene();
  }

  function handleBottleSelect(bottle, triggerElement) {
    selectedBottleTriggerRef.current = triggerElement || null;
    setSelectedBottleId(bottle.cellarEntryId);
    setIsDetailPanelOpen(true);
  }

  function handlePanelClose() {
    setIsDetailPanelOpen(false);
    setSelectedBottleId(null);
    window.requestAnimationFrame(() => {
      selectedBottleTriggerRef.current?.focus();
      selectedBottleTriggerRef.current = null;
    });
  }

  function handleResetCellar() {
    setActiveSectionId(null);
    setHoveredSectionId(null);
    setHoveredBottleId(null);
    setSelectedBottleId(null);
    setIsDetailPanelOpen(false);
    selectedBottleTriggerRef.current = null;
  }

  function updateBottle(cellarEntryId, patch) {
    setSections((currentSections) =>
      currentSections.map((section) => ({
        ...section,
        bottles: section.bottles.map((bottle) =>
          bottle.cellarEntryId === cellarEntryId ? { ...bottle, ...patch } : bottle
        ),
      }))
    );
  }

  function handleToggleFavorite(cellarEntryId) {
    const bottle = bottles.find((item) => item.cellarEntryId === cellarEntryId);

    if (!bottle) {
      return;
    }

    updateBottle(cellarEntryId, { favorite: !bottle.favorite });
  }

  function handleRemoveBottle(cellarEntryId) {
    setSections((currentSections) =>
      currentSections.map((section) => ({
        ...section,
        bottles: section.bottles.filter((bottle) => bottle.cellarEntryId !== cellarEntryId),
      }))
    );
    setSelectedBottleId(null);
    setIsDetailPanelOpen(false);
    selectedBottleTriggerRef.current = null;
  }

  if (bottles.length === 0) {
    return <EmptyCellarState />;
  }

  return (
    <div className="interactive-cellar-page">
      <CellarIntro onEnter={scrollToScene} />

      <div className="interactive-cellar-stage" ref={sceneRef}>
        <CellarControls
          activeSection={activeSection}
          onCloseDetails={handlePanelClose}
          onReset={handleResetCellar}
          selectedBottle={selectedBottle}
        />

        <div className="interactive-cellar-layout">
          <CellarScene
            activeSection={activeSectionId}
            hoveredBottleId={hoveredBottleId}
            hoveredSection={hoveredSectionId}
            onBottleHover={setHoveredBottleId}
            onBottleSelect={handleBottleSelect}
            onSectionHover={setHoveredSectionId}
            onSectionSelect={handleSectionSelect}
            sections={sections}
            selectedBottleId={selectedBottleId}
          />

          <BottleDetailPanel
            bottle={selectedBottle}
            isOpen={isDetailPanelOpen}
            onClose={handlePanelClose}
            onRemove={handleRemoveBottle}
            onToggleFavorite={handleToggleFavorite}
            onUpdate={updateBottle}
          />
        </div>
      </div>
    </div>
  );
}
