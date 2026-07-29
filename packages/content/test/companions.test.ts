import {
  britishGentlemanWorld,
  butlerMoodLabels,
  companionMoodArtwork,
  getCompanionArtwork,
  type ButlerMood
} from "../src/index";
import { describe, expect, it } from "vitest";

const moods: ButlerMood[] = [
  "DELIGHTED",
  "PROUD",
  "CHEERFUL",
  "CALM",
  "WORRIED",
  "LONELY",
  "SULKING"
];

describe("companion mood artwork", () => {
  it("provides a Lucien portrait for every mood", () => {
    for (const mood of moods) {
      expect(getCompanionArtwork(britishGentlemanWorld.character.id, mood)).toBe(
        companionMoodArtwork[britishGentlemanWorld.character.id][mood]
      );
    }
  });

  it("falls back for companions without mood variants", () => {
    expect(getCompanionArtwork("character-butler-rowan", "CALM")).toBeUndefined();
  });

  it("provides Japanese-first bilingual labels for every mood", () => {
    for (const mood of moods) {
      expect(butlerMoodLabels[mood]).toMatch(/^[^A-Z]+ \/ [A-Z]+$/);
      expect(butlerMoodLabels[mood]).toContain(mood);
    }
  });
});
