import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import BottleDetailPanel from "./BottleDetailPanel.jsx";
import CellarControls from "./CellarControls.jsx";
import CellarIntro from "./CellarIntro.jsx";
import CellarScene from "./CellarScene.jsx";
import { demoCellarBottles, demoCellarSections } from "../../../data/demoCellar";

export default function OpenCellarPage() {
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [hoveredSectionId, setHoveredSectionId] = useState(null);
  const [selectedBottleId, setSelectedBottleId] = useState(null);
  const [hoveredBottleId, setHoveredBottleId] = useState(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const sceneRef = useRef(null);
  const selectedBottleTriggerRef = useRef(null);

  const bottles = demoCellarBottles;
  const selectedBottle =
    bottles.find((bottle) => bottle.cellarEntryId === selectedBottleId) || null;
  const activeSection =
    demoCellarSections.find((section) => section.sectionId === activeSectionId) || null;

  function scrollToScene() {
    sceneRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
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
            sections={demoCellarSections}
            selectedBottleId={selectedBottleId}
          />

          <BottleDetailPanel
            bottle={selectedBottle}
            isOpen={isDetailPanelOpen}
            onClose={handlePanelClose}
          />
        </div>
      </div>
    </div>
  );
}
