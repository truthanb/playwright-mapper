const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if HEAD is a merge commit (has 2+ parents)
 * @param {boolean} verbose - Print debug info
 * @returns {boolean}
 */
function isMergeCommit(verbose = false) {
  try {
    const parents = execSync('git rev-list --parents -n 1 HEAD', { encoding: 'utf-8' })
      .trim()
      .split(/\s+/);
    // First element is the commit itself, remaining are parents
    const parentCount = parents.length - 1;
    if (verbose) {
      console.log(`[mapper] HEAD has ${parentCount} parent(s) — ${parentCount >= 2 ? 'merge commit' : 'regular commit'}`);
    }
    return parentCount >= 2;
  } catch {
    return false;
  }
}

/**
 * Get changed files from a merge commit by diffing against its first parent.
 * This shows exactly what the merge introduced relative to the target branch.
 * @param {boolean} verbose - Print debug info
 * @returns {string[]} Array of changed file paths
 */
function getChangedFilesFromMergeCommit(verbose = false) {
  try {
    const diffCommand = 'git diff --name-only HEAD^1 HEAD';
    if (verbose) {
      console.log(`[mapper] Using merge-commit diff: ${diffCommand}`);
    }
    const output = execSync(diffCommand, { encoding: 'utf-8' }).trim();
    if (!output) {
      return [];
    }
    return output.split('\n').filter(file => file);
  } catch (error) {
    if (verbose) {
      console.warn('[mapper] Error getting merge commit diff:', error.message);
    }
    return [];
  }
}

/**
 * Get list of changed files between current branch and base branch
 * @param {string} baseBranch - Branch to diff against (default: 'main')
 * @param {boolean} verbose - Print debug info
 * @param {string} diffStrategy - Strategy for detecting changes: 'branch' | 'merge-commit' | 'auto' (default: 'branch')
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(baseBranch = 'main', verbose = false, diffStrategy = 'branch') {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD')
      .toString()
      .trim();

    if (verbose) {
      console.log(`[mapper] Current branch: ${currentBranch}`);
      console.log(`[mapper] Base branch: ${baseBranch}`);
      console.log(`[mapper] Diff strategy: ${diffStrategy}`);
    }

    // If explicitly using merge-commit strategy, go straight to that
    if (diffStrategy === 'merge-commit') {
      if (!isMergeCommit(verbose)) {
        if (verbose) {
          console.log('[mapper] HEAD is not a merge commit; falling back to single-parent diff (HEAD~1..HEAD)');
        }
        try {
          const output = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf-8' }).trim();
          const files = output ? output.split('\n').filter(file => file) : [];
          if (verbose && files.length > 0) {
            console.log('[mapper] Changed files (from parent diff):');
            files.forEach(file => console.log(` - ${file}`));
          }
          return files;
        } catch (error) {
          if (verbose) {
            console.warn('[mapper] Error getting parent diff:', error.message);
          }
          return [];
        }
      }
      const files = getChangedFilesFromMergeCommit(verbose);
      if (verbose) {
        if (files.length > 0) {
          console.log('[mapper] Changed files (from merge commit):');
          files.forEach(file => console.log(` - ${file}`));
        } else {
          console.log('[mapper] No changed files detected from merge commit');
        }
      }
      return files;
    }

    const allFiles = new Set();

    // Get committed changes compared to base branch
    const diffCommand = `git diff --name-only ${baseBranch}...HEAD`;
    const committedOutput = execSync(diffCommand, { encoding: 'utf-8' }).trim();
    
    if (committedOutput) {
      committedOutput.split('\n').filter(file => file).forEach(file => allFiles.add(file));
    }

    // Get uncommitted changes (staged and unstaged)
    const unstagedCommand = 'git diff --name-only';
    const unstagedOutput = execSync(unstagedCommand, { encoding: 'utf-8' }).trim();
    
    if (unstagedOutput) {
      unstagedOutput.split('\n').filter(file => file).forEach(file => allFiles.add(file));
    }

    // Get staged changes
    const stagedCommand = 'git diff --name-only --cached';
    const stagedOutput = execSync(stagedCommand, { encoding: 'utf-8' }).trim();
    
    if (stagedOutput) {
      stagedOutput.split('\n').filter(file => file).forEach(file => allFiles.add(file));
    }

    const files = Array.from(allFiles);

    // In 'auto' mode: if branch diff found nothing, check if we're on a merge commit
    // and fall back to diffing against the first parent
    if (files.length === 0 && diffStrategy === 'auto') {
      if (verbose) {
        console.log('[mapper] No changes from branch diff — checking if HEAD is a merge commit...');
      }
      if (isMergeCommit(verbose)) {
        const mergeFiles = getChangedFilesFromMergeCommit(verbose);
        if (mergeFiles.length > 0) {
          if (verbose) {
            console.log('[mapper] Changed files (from merge commit fallback):');
            mergeFiles.forEach(file => console.log(` - ${file}`));
          }
          return mergeFiles;
        }
      }
    }

    if (files.length === 0) {
      if (verbose) {
        console.log('[mapper] No changed files detected');
      }
      return [];
    }

    if (verbose) {
      console.log('[mapper] Changed files:');
      files.forEach(file => console.log(` - ${file}`));
    }

    return files;
  } catch (error) {
    if (verbose) {
      console.warn('[mapper] Error detecting changed files:', error.message);
    }
    return [];
  }
}

/**
 * Load mappings from a file
 * @param {string} mappingsFile - Path to mappings file
 * @returns {Object} Mappings object
 */
function loadMappings(mappingsFile) {
  const resolvedPath = path.resolve(process.cwd(), mappingsFile);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Mappings file not found: ${resolvedPath}`);
  }

  // Clear require cache to get fresh mappings
  delete require.cache[require.resolve(resolvedPath)];
  
  const mappings = require(resolvedPath);
  return mappings.default || mappings;
}

/**
 * Map changed files to test tags based on mappings
 * @param {string[]} changedFiles - Array of changed file paths
 * @param {Object|string} mappingsOrFile - Mappings object or path to mappings file
 * @param {boolean} verbose - Print debug info
 * @returns {string[]} Array of test tags
 */
function getMappedTags(changedFiles, mappingsOrFile, verbose = false) {
  const mappings = typeof mappingsOrFile === 'string' 
    ? loadMappings(mappingsOrFile)
    : mappingsOrFile;

  const tags = new Set();

  changedFiles.forEach(file => {
    for (const [tag, paths] of Object.entries(mappings)) {
      if (paths.some(path => file.startsWith(path))) {
        tags.add(tag);
        if (verbose) {
          console.log(`[mapper] ${file} → ${tag}`);
        }
      }
    }
  });

  return Array.from(tags);
}

/**
 * Compute grep pattern from test tags
 * @param {string[]} tags - Array of test tags
 * @param {Object} options - Options object
 * @param {boolean} options.addBaseline - Include @baseline tag (default: true)
 * @returns {string} Grep pattern for Playwright
 */
function computeGrepPattern(tags, options = {}) {
  const { addBaseline = true } = options;
  
  const allTags = [...tags];
  
  // Add baseline tag if enabled and not already present
  if (addBaseline && !allTags.includes('@baseline')) {
    allTags.push('@baseline');
  }

  // If no tags, fallback to baseline only
  if (allTags.length === 0) {
    return '@baseline';
  }

  // Create regex pattern
  return `(${allTags.join('|')})`;
}

/**
 * Run Playwright with computed grep pattern
 * @param {string} grepPattern - Grep pattern to pass to Playwright
 * @param {string[]} additionalArgs - Additional arguments for Playwright
 * @returns {number} Exit code from Playwright
 */
function runPlaywright(grepPattern, additionalArgs = []) {
  const args = [
    'npx',
    'playwright',
    'test',
    '-g',
    `"${grepPattern}"`,
    ...additionalArgs
  ].join(' ');

  try {
    execSync(args, { stdio: 'inherit' });
    return 0;
  } catch (error) {
    return error.status || 1;
  }
}

module.exports = {
  getChangedFiles,
  getChangedFilesFromMergeCommit,
  isMergeCommit,
  getMappedTags,
  computeGrepPattern,
  runPlaywright,
  loadMappings,
};
