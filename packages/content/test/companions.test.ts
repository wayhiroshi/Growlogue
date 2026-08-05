import {
  britishGentlemanWorld,
  butlerMoodLabels,
  companionMoodArtwork,
  companions,
  getEncoreLucienMessage,
  getCompanionArtwork,
  getHabitEncoreRule,
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
    expect(
      getCompanionArtwork("character-attendant-cedric", "CALM")
    ).toBeUndefined();
  });

  it("includes Lawrence as a selectable shoebill companion", () => {
    expect(companions).toContainEqual({
      id: "character-attendant-cedric",
      name: "Lawrence（ロウレンス）",
      personality: "寡黙で観察眼に優れ、確認と見守りを担うハシビロコウの筆頭執事",
      avatarUrl: "/images/companions/lawrence.webp"
    });
  });

  it("provides Japanese-first bilingual labels for every mood", () => {
    for (const mood of moods) {
      expect(butlerMoodLabels[mood]).toMatch(/^[^A-Z]+ \/ [A-Z]+$/);
      expect(butlerMoodLabels[mood]).toContain(mood);
    }
  });

  it("enables encores only for the initial strength and English habits", () => {
    expect(getHabitEncoreRule("user-id:template-strength")).toMatchObject({
      amount: 10,
      unit: "回"
    });
    expect(getHabitEncoreRule("user-id:template-english")).toMatchObject({
      amount: 1,
      unit: "レッスン"
    });
    expect(getHabitEncoreRule("user-id:template-writing")).toBeUndefined();
  });

  it("closes a long encore run with a rest-positive Lucien message", () => {
    expect(getEncoreLucienMessage(5)).toContain("休む");
  });
});
