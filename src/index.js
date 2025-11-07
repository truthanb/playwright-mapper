const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Get list of changed files between current branch and base branch
 * @param {string} baseBranch - Branch to diff against (default: 'main')
 * @param {boolean} verbose - Print debug info
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(baseBranch = 'main', verbose = false) {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD')
      .toString()
      .trim();

    if (verbose) {
      console.log(`[mapper] Current branch: ${currentBranch}`);
      console.log(`[mapper] Base branch: ${baseBranch}`);
    }

    // Use triple-dot diff to compare against merge base
    const diffCommand = `git diff --name-only ${baseBranch}...HEAD`;
    const output = execSync(diffCommand, { encoding: 'utf-8' }).trim();

    if (!output) {
      if (verbose) {
        console.log('[mapper] No changed files detected');
      }
      return [];
    }

    const files = output.split('\n').filter(file => file);

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
  getMappedTags,
  computeGrepPattern,
  runPlaywright,
  loadMappings,
};
