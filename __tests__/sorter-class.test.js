import WavSorter from "../assets/sorter-class.js";
import { wavNames } from "../assets/member-data.js";

function finishWithAlphabeticalPreference(sorter) {
  let safety = 0;
  while (!sorter.isComplete() && safety < 5000) {
    const comparison = sorter.getCurrentComparison();
    expect(comparison).not.toBeNull();
    if (comparison.memberAName.localeCompare(comparison.memberBName) <= 0) {
      sorter.preferMemberA();
    } else {
      sorter.preferMemberB();
    }
    safety++;
  }
  expect(safety).toBeLessThan(5000);
}

describe("WavSorter", () => {
  test("rejects invalid member lists", () => {
    expect(() => new WavSorter("not an array")).toThrow("Member names must be an array");
    expect(() => new WavSorter(["A", 2])).toThrow("Every member name must be a string");
  });

  test("handles an empty list", () => {
    const sorter = new WavSorter([]);
    expect(sorter.isComplete()).toBe(true);
    expect(sorter.getSortedMembers()).toEqual([]);
    expect(sorter.getProgress().progressPercent).toBe(100);
  });

  test("handles one WAV", () => {
    const sorter = new WavSorter(["A"]);
    expect(sorter.isComplete()).toBe(true);
    expect(sorter.getSortedMembers()).toEqual(["A"]);
  });

  test("sorts two WAVs", () => {
    const sorter = new WavSorter(["A", "B"]);
    const comparison = sorter.getCurrentComparison();
    sorter.preferMemberA();
    expect(sorter.isComplete()).toBe(true);
    expect(sorter.getSortedMembers()).toEqual([
      comparison.memberAName,
      comparison.memberBName,
    ]);
  });

  test("sorts a larger list consistently", () => {
    const members = ["Zeta", "Gamma", "Alpha", "Beta", "Delta"];
    const sorter = new WavSorter(members);
    finishWithAlphabeticalPreference(sorter);
    expect(sorter.getSortedMembers()).toEqual([...members].sort((a, b) => a.localeCompare(b)));
  });

  test("supports the complete current WAV list", () => {
    expect(wavNames).toHaveLength(93);
    const sorter = new WavSorter(wavNames);
    finishWithAlphabeticalPreference(sorter);
    const result = sorter.getSortedMembers();
    expect(result).toHaveLength(93);
    expect(new Set(result).size).toBe(93);
    expect([...result].sort()).toEqual([...wavNames].sort());
    expect(sorter.getProgress().progressPercent).toBe(100);
  });

  test("getState and restoreState power Undo", () => {
    const sorter = new WavSorter(["A", "B", "C", "D"]);
    const firstComparison = sorter.getCurrentComparison();
    const before = sorter.getState();

    sorter.preferMemberA();
    expect(sorter.getProgress().currentQuestion).toBeGreaterThan(before.numQuestion);

    sorter.restoreState(before);
    expect(sorter.getCurrentComparison()).toEqual(firstComparison);
    expect(sorter.getProgress().currentQuestion).toBe(before.numQuestion);
  });

  test("restored state can continue to completion", () => {
    const members = ["A", "B", "C", "D", "E", "F"];
    const first = new WavSorter(members);
    first.preferMemberA();
    first.preferMemberB();
    const snapshot = first.getState();

    const resumed = new WavSorter(members);
    resumed.restoreState(snapshot);
    finishWithAlphabeticalPreference(resumed);

    expect(resumed.isComplete()).toBe(true);
    expect(resumed.getSortedMembers()).toHaveLength(members.length);
  });

  test("markCompleteWithOrder restores a finished ranking", () => {
    const members = ["A", "B", "C"];
    const sorter = new WavSorter(members);
    sorter.markCompleteWithOrder(["C", "A", "B"]);
    expect(sorter.isComplete()).toBe(true);
    expect(sorter.getSortedMembers()).toEqual(["C", "A", "B"]);
  });

  test("markCompleteWithOrder rejects unknown or duplicate names", () => {
    const sorter = new WavSorter(["A", "B", "C"]);
    expect(() => sorter.markCompleteWithOrder(["A", "B"])).toThrow();
    expect(() => sorter.markCompleteWithOrder(["A", "B", "X"])).toThrow();
    expect(() => sorter.markCompleteWithOrder(["A", "A", "C"])).toThrow();
  });
});
