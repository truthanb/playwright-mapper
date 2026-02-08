type DiffStrategy = 'branch' | 'merge-commit' | 'auto';

interface MapperOptions {
  baseBranch?: string;
  mappingsFile?: string;
  alwaysRunTags?: string[];
  verbose?: boolean;
  diffStrategy?: DiffStrategy;
}

declare function getChangedFiles(baseBranch?: string, verbose?: boolean, diffStrategy?: DiffStrategy): string[];

declare function getChangedFilesFromMergeCommit(verbose?: boolean): string[];

declare function isMergeCommit(verbose?: boolean): boolean;

declare function getMappedTags(changedFiles: string[], mappingsOrFile: string | object, verbose?: boolean): string[];

declare function computeGrepPattern(tags: string[], options?: { addBaseline?: boolean }): string;

declare function runPlaywright(tags: string[], extraFlags?: string): void;

export {
  DiffStrategy,
  MapperOptions,
  getChangedFiles,
  getChangedFilesFromMergeCommit,
  isMergeCommit,
  getMappedTags,
  computeGrepPattern,
  runPlaywright,
};