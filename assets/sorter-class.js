/**
 * Generic pairwise merge-sort ranking engine used by WAV Sorter.
 * It has no dependency on images, Discord APIs, or tripleS member data.
 */
export default class WavSorter {
  #lstMember = [];
  #parent = [];
  #equal = [];
  #rec = [];
  #cmp1 = 0;
  #cmp2 = 0;
  #head1 = 0;
  #head2 = 0;
  #nrec = 0;
  #numQuestion = 0;
  #totalSize = 0;
  #finishSize = 0;
  #finishFlag = 0;

  constructor(memberNames) {
    if (!Array.isArray(memberNames)) {
      throw new Error("Member names must be an array");
    }
    if (memberNames.some((name) => typeof name !== "string")) {
      throw new Error("Every member name must be a string");
    }

    this.memberNames = [...memberNames];
    this.initialize();
  }

  get equal() {
    return [...this.#equal];
  }

  initialize() {
    if (this.memberNames.length <= 1) {
      this.#finishFlag = 1;
      this.#lstMember = [this.memberNames.map((_, index) => index)];
      this.#parent = [-1];
      this.#equal = new Array(this.memberNames.length + 1).fill(-1);
      this.#rec = new Array(this.memberNames.length).fill(0);
      this.#cmp1 = -1;
      this.#cmp2 = -1;
      this.#head1 = 0;
      this.#head2 = 0;
      this.#nrec = 0;
      this.#numQuestion = 0;
      this.#totalSize = 0;
      this.#finishSize = 0;
      return;
    }

    const shuffledIndices = [...Array(this.memberNames.length).keys()];
    this.#shuffle(shuffledIndices);

    const result = this.#buildTree(shuffledIndices);
    this.#lstMember = result.tree;
    this.#parent = result.parent;
    this.#totalSize = result.totalSize;

    this.#rec = new Array(this.memberNames.length).fill(0);
    this.#nrec = 0;
    this.#equal = new Array(this.memberNames.length + 1).fill(-1);
    this.#cmp1 = this.#lstMember.length - 2;
    this.#cmp2 = this.#lstMember.length - 1;
    this.#head1 = 0;
    this.#head2 = 0;
    this.#numQuestion = 1;
    this.#finishSize = 0;
    this.#finishFlag = 0;
  }

  getCurrentComparison() {
    if (this.isComplete() || this.#cmp1 < 0) return null;

    const memberAIndex = this.#lstMember[this.#cmp1][this.#head1];
    const memberBIndex = this.#lstMember[this.#cmp2][this.#head2];

    if (memberAIndex === undefined || memberBIndex === undefined) return null;

    return {
      memberA: memberAIndex,
      memberB: memberBIndex,
      memberAName: this.memberNames[memberAIndex],
      memberBName: this.memberNames[memberBIndex],
    };
  }

  preferMemberA() {
    this.#applyComparisonResult(-1);
  }

  preferMemberB() {
    this.#applyComparisonResult(1);
  }

  // Kept in the engine for compatibility even though the WAV UI has no tie button.
  declareTie() {
    this.#applyComparisonResult(0);
  }

  getSortedMembers() {
    if (!this.isComplete()) return [];
    return this.#lstMember[0].map((index) => this.memberNames[index]);
  }

  isComplete() {
    return this.#finishFlag === 1 || this.memberNames.length <= 1;
  }

  getProgress() {
    const progressPercent = this.#totalSize === 0
      ? (this.isComplete() ? 100 : 0)
      : Math.min(100, Math.floor((this.#finishSize * 100) / this.#totalSize));

    return {
      currentQuestion: this.#numQuestion,
      progressPercent,
      completedComparisons: this.#finishSize,
      totalComparisons: this.#totalSize,
      isComplete: this.isComplete(),
    };
  }

  reset() {
    this.initialize();
  }

  /** Return a serializable snapshot used by Undo and local autosave. */
  getState() {
    return {
      lstMember: this.#lstMember.map((list) => [...list]),
      parent: [...this.#parent],
      equal: [...this.#equal],
      rec: [...this.#rec],
      cmp1: this.#cmp1,
      cmp2: this.#cmp2,
      head1: this.#head1,
      head2: this.#head2,
      nrec: this.#nrec,
      numQuestion: this.#numQuestion,
      totalSize: this.#totalSize,
      finishSize: this.#finishSize,
      finishFlag: this.#finishFlag,
    };
  }

  /** Restore a snapshot previously returned by getState(). */
  restoreState(state) {
    if (
      !state ||
      !Array.isArray(state.lstMember) ||
      !Array.isArray(state.parent) ||
      !Array.isArray(state.equal) ||
      !Array.isArray(state.rec)
    ) {
      throw new Error("Invalid sorter state");
    }

    const numericFields = [
      "cmp1", "cmp2", "head1", "head2", "nrec", "numQuestion",
      "totalSize", "finishSize", "finishFlag",
    ];
    if (numericFields.some((key) => !Number.isFinite(state[key]))) {
      throw new Error("Invalid sorter state");
    }

    this.#lstMember = state.lstMember.map((list) => [...list]);
    this.#parent = [...state.parent];
    this.#equal = [...state.equal];
    this.#rec = [...state.rec];
    this.#cmp1 = state.cmp1;
    this.#cmp2 = state.cmp2;
    this.#head1 = state.head1;
    this.#head2 = state.head2;
    this.#nrec = state.nrec;
    this.#numQuestion = state.numQuestion;
    this.#totalSize = state.totalSize;
    this.#finishSize = state.finishSize;
    this.#finishFlag = state.finishFlag;
  }

  /** Useful when loading a previously completed ranking. */
  markCompleteWithOrder(orderNames) {
    if (!Array.isArray(orderNames) || orderNames.length !== this.memberNames.length) {
      throw new Error("Completed order must contain every selected WAV exactly once");
    }

    const indexByName = new Map(this.memberNames.map((name, index) => [name, index]));
    const seen = new Set();
    const indices = orderNames.map((name) => {
      const index = indexByName.get(name);
      if (index === undefined || seen.has(name)) {
        throw new Error(`Unknown or duplicate WAV: ${name}`);
      }
      seen.add(name);
      return index;
    });

    this.#lstMember = [indices];
    this.#parent = [-1];
    this.#equal = new Array(this.memberNames.length + 1).fill(-1);
    this.#rec = new Array(this.memberNames.length).fill(0);
    this.#cmp1 = -1;
    this.#cmp2 = -1;
    this.#head1 = 0;
    this.#head2 = 0;
    this.#nrec = 0;
    this.#numQuestion = 0;
    this.#totalSize = 0;
    this.#finishSize = 0;
    this.#finishFlag = 1;
  }

  #shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  #buildTree(indices) {
    const tree = [indices];
    const parent = [-1];
    let totalSize = 0;
    let n = 1;

    for (let i = 0; i < tree.length; i++) {
      if (tree[i].length >= 2) {
        const mid = Math.ceil(tree[i].length / 2);

        tree[n] = tree[i].slice(0, mid);
        totalSize += tree[n].length;
        parent[n] = i;
        n++;

        tree[n] = tree[i].slice(mid);
        totalSize += tree[n].length;
        parent[n] = i;
        n++;
      }
    }

    return { tree, parent, totalSize };
  }

  #recordMember(memberIndex) {
    this.#rec[this.#nrec] = memberIndex;
    this.#nrec++;
  }

  #drainList(listIndex) {
    const list = this.#lstMember[listIndex];
    let head = listIndex === this.#cmp1 ? this.#head1 : this.#head2;

    this.#recordMember(list[head]);
    head++;
    this.#finishSize++;

    while (this.#equal[this.#rec[this.#nrec - 1]] !== -1) {
      this.#recordMember(list[head]);
      head++;
      this.#finishSize++;
    }

    if (listIndex === this.#cmp1) this.#head1 = head;
    else this.#head2 = head;
  }

  #flushRemaining(listIndex) {
    const isCmp1 = listIndex === this.#cmp1;
    const head = isCmp1 ? this.#head1 : this.#head2;
    const otherHead = isCmp1 ? this.#head2 : this.#head1;
    const list = this.#lstMember[listIndex];
    const otherList = this.#lstMember[isCmp1 ? this.#cmp2 : this.#cmp1];

    if (head < list.length && otherHead === otherList.length) {
      let h = head;
      while (h < list.length) {
        this.#recordMember(list[h]);
        h++;
        this.#finishSize++;
      }
      if (isCmp1) this.#head1 = h;
      else this.#head2 = h;
    }
  }

  #applyComparisonResult(flag) {
    if (this.isComplete()) return;
    if (![-1, 0, 1].includes(flag)) {
      throw new Error("Invalid preference flag");
    }

    if (flag === 0) {
      this.#drainList(this.#cmp1);
      this.#equal[this.#rec[this.#nrec - 1]] =
        this.#lstMember[this.#cmp2][this.#head2];
      this.#drainList(this.#cmp2);
    } else {
      this.#drainList(flag < 0 ? this.#cmp1 : this.#cmp2);
    }

    this.#flushRemaining(this.#cmp1);
    this.#flushRemaining(this.#cmp2);

    if (
      this.#head1 === this.#lstMember[this.#cmp1].length &&
      this.#head2 === this.#lstMember[this.#cmp2].length
    ) {
      this.#mergeLists();
    }

    this.#numQuestion++;
    if (this.#cmp1 < 0) this.#finishFlag = 1;
  }

  #mergeLists() {
    const parentIndex = this.#parent[this.#cmp1];
    const mergedLength =
      this.#lstMember[this.#cmp1].length + this.#lstMember[this.#cmp2].length;

    for (let i = 0; i < mergedLength; i++) {
      this.#lstMember[parentIndex][i] = this.#rec[i];
    }

    this.#lstMember.pop();
    this.#lstMember.pop();
    this.#parent.pop();
    this.#parent.pop();
    this.#cmp1 -= 2;
    this.#cmp2 -= 2;
    this.#head1 = 0;
    this.#head2 = 0;
    this.#nrec = 0;
  }
}
