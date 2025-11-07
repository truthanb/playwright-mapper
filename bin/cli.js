#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { 
  getChangedFiles, 
  getMappedTags, 
  computeGrepPattern, 
  runPlaywright,
  loadMappings 
} = require('../src/index');

// Default configuration
const DEFAULT_CONFIG = {
  mappingsFile: 'test-mappings.js',
  baseBranch: 'main',
  addBaseline: true,
  verbose: false,
};

/**
 * Load configuration from .mapperrc or return defaults
 */
function loadConfig() {
  const configPath = path.resolve(process.cwd(), '.mapperrc');
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
      console.warn('[mapper] Error loading .mapperrc, using defaults');
      return DEFAULT_CONFIG;
    }
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const parsed = {
    command: 'run',
    config: loadConfig(),
    playwrightArgs: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Commands
    if (!arg.startsWith('-') && i === 0) {
      parsed.command = arg;
      continue;
    }

    // Flags
    if (arg === '--base-branch' || arg === '-b') {
      parsed.config.baseBranch = args[++i];
    } else if (arg === '--mappings-file' || arg === '-m') {
      parsed.config.mappingsFile = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.config.verbose = true;
    } else if (arg === '--no-baseline') {
      parsed.config.addBaseline = false;
    } else if (arg === '--help' || arg === '-h') {
      parsed.command = 'help';
    } else {
      // Pass through to Playwright
      parsed.playwrightArgs.push(arg);
    }
  }

  return parsed;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
🎯 playwright-mapper - Run only the Playwright tests that matter

Usage:
  npx playwright-mapper [command] [options]

Commands:
  run             Run Playwright tests with mapped tags (default)
  list            Show changed files and mapped tags without running tests
  init            Create sample test-mappings.js and .mapperrc.json files
  help            Show this help message

Options:
  -b, --base-branch <branch>    Branch to diff against (default: main)
  -m, --mappings-file <file>    Path to mappings file (default: test-mappings.js)
  -v, --verbose                 Print detailed debug info
  --no-baseline                 Don't include @baseline in grep pattern

Examples:
  npx playwright-mapper
  npx playwright-mapper list
  npx playwright-mapper --base-branch develop
  npx playwright-mapper --verbose
  npx playwright-mapper -- --headed --project=chromium

Environment Variables:
  MAPPER_DISABLE=1              Bypass mapper and run all tests
`);
}

/**
 * Initialize sample files
 */
function initCommand() {
  const mappingsPath = path.resolve(process.cwd(), 'test-mappings.js');
  const configPath = path.resolve(process.cwd(), '.mapperrc');

  // Create sample mappings file
  if (!fs.existsSync(mappingsPath)) {
    const sampleMappings = `// Test tag to file path mappings
module.exports = {
  "@auth": [
    "src/auth/",
    "src/middleware/auth.js"
  ],
  "@api": [
    "src/api/",
    "src/services/"
  ],
  "@ui": [
    "src/components/",
    "src/pages/"
  ],
};
`;
    fs.writeFileSync(mappingsPath, sampleMappings);
    console.log('✅ Created test-mappings.js');
  } else {
    console.log('⚠️  test-mappings.js already exists, skipping');
  }

  // Create sample config file
  if (!fs.existsSync(configPath)) {
    const sampleConfig = {
      mappingsFile: "test-mappings.js",
      baseBranch: "main",
      addBaseline: true,
      verbose: false
    };
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));
    console.log('✅ Created .mapperrc');
  } else {
    console.log('⚠️  .mapperrc already exists, skipping');
  }

  console.log('\n🎉 Setup complete! Edit test-mappings.js to define your tag→path mappings.');
}

/**
 * List command - show what would run without executing
 */
function listCommand(config) {
  console.log('\n[mapper] Configuration:');
  console.log(`  Base branch: ${config.baseBranch}`);
  console.log(`  Mappings file: ${config.mappingsFile}`);
  console.log(`  Add baseline: ${config.addBaseline}`);

  const changedFiles = getChangedFiles(config.baseBranch, true);

  if (changedFiles.length === 0) {
    console.log('\n[mapper] No changed files detected');
    console.log('[mapper] Would run: @baseline only');
    return;
  }

  console.log(); // Blank line for spacing

  try {
    const mappings = loadMappings(config.mappingsFile);
    const tags = getMappedTags(changedFiles, mappings, true);
    const grepPattern = computeGrepPattern(tags, { addBaseline: config.addBaseline });

    console.log(`\n[mapper] Mapped test tags: ${tags.join(', ') || 'none'}`);
    console.log(`[mapper] Grep pattern: ${grepPattern}`);
    console.log(`[mapper] Would run: npx playwright test -g "${grepPattern}"`);
  } catch (error) {
    console.error('[mapper] Error:', error.message);
    process.exit(1);
  }
}

/**
 * Run command - detect changes and run tests
 */
function runCommand(config, playwrightArgs) {
  // Check for disable flag
  if (process.env.MAPPER_DISABLE === '1') {
    console.log('[mapper] MAPPER_DISABLE=1, running all tests');
    return runPlaywright('.*', playwrightArgs);
  }

  if (config.verbose) {
    console.log('\n[mapper] Configuration:');
    console.log(`  Base branch: ${config.baseBranch}`);
    console.log(`  Mappings file: ${config.mappingsFile}`);
    console.log(`  Add baseline: ${config.addBaseline}`);
    console.log();
  }

  const changedFiles = getChangedFiles(config.baseBranch, config.verbose);

  if (changedFiles.length === 0) {
    if (config.verbose) {
      console.log('[mapper] No changes detected, running @baseline tests only');
    }
    return runPlaywright('@baseline', playwrightArgs);
  }

  try {
    const mappings = loadMappings(config.mappingsFile);
    const tags = getMappedTags(changedFiles, mappings, config.verbose);
    const grepPattern = computeGrepPattern(tags, { addBaseline: config.addBaseline });

    if (config.verbose) {
      console.log(`\n[mapper] Mapped test tags: ${tags.join(', ') || 'none'}`);
      console.log(`[mapper] Running: npx playwright test -g "${grepPattern}"`);
      console.log();
    }

    return runPlaywright(grepPattern, playwrightArgs);
  } catch (error) {
    console.error('[mapper] Error:', error.message);
    console.error('[mapper] Falling back to running all tests');
    return runPlaywright('.*', playwrightArgs);
  }
}

/**
 * Main CLI entry point
 */
function main() {
  const args = process.argv.slice(2);
  const { command, config, playwrightArgs } = parseArgs(args);

  switch (command) {
    case 'help':
      printHelp();
      process.exit(0);
      break;

    case 'init':
      initCommand();
      process.exit(0);
      break;

    case 'list':
      listCommand(config);
      process.exit(0);
      break;

    case 'run':
    default:
      const exitCode = runCommand(config, playwrightArgs);
      process.exit(exitCode);
  }
}

// Run CLI
main();
