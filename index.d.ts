interface MapperOptions {
  baseBranch?: string;
  mappingsFile?: string;
  alwaysRunTags?: string[];
  verbose?: boolean;
}

declare function getChangedFiles(baseBranch?: string, verbose?: boolean): string[];

declare function getMappedTags(changedFiles: string[], mappingsOrFile: string | object, verbose?: boolean): string[];

declare function computeGrepPattern(tags: string[], options?: { addBaseline?: boolean }): string;

declare function runPlaywright(tags: string[], extraFlags?: string): void;

export {
  MapperOptions,
  getChangedFiles,
  getMappedTags,
  computeGrepPattern,
  runPlaywright,
};