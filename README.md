# playwright-mapper

**Intelligent test execution for Playwright**

Run only the tests that matter by automatically detecting changed files and mapping them to relevant test suites. Reduce CI time and get faster feedback without modifying your existing Playwright configuration.

## Installation

```bash
npm install -D playwright-mapper
```

## Quick Start

### 1. Initialize configuration

```bash
npx playwright-mapper init
```

This creates `test-mappings.js` and `.mapperrc` in your project root.

### 2. Define your test mappings

```js
// test-mappings.js
module.exports = {
  "@auth": ["src/auth/", "src/middleware/auth.js"],
  "@api": ["src/api/", "src/services/"],
  "@ui": ["src/components/", "src/pages/"],
};
```

Map test tags to file paths or directories. When files matching these paths change, tests with the corresponding tags will run.

### 3. Tag your tests

```js
// tests/auth.spec.js
test.describe('Authentication @auth @baseline', () => {
  test('user login', async ({ page }) => {
    // test implementation
  });
});
```

### 4. Run tests

```bash
npx playwright-mapper
```

The tool will:
1. Detect changed files in your branch
2. Match them against your mappings
3. Run only tests with relevant tags
4. Always include `@baseline` tests for critical paths

## Configuration

Create a `.mapperrc` file in your project root:

```json
{
  "mappingsFile": "test-mappings.js",
  "baseBranch": "main",
  "addBaseline": true,
  "verbose": false
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mappingsFile` | string | `test-mappings.js` | Path to your mappings file |
| `baseBranch` | string | `main` | Branch to compare against |
| `addBaseline` | boolean | `true` | Always include @baseline tests |
| `verbose` | boolean | `false` | Enable detailed logging |

### CLI Options

```bash
npx playwright-mapper [command] [options]
```

**Commands:**
- `run` - Execute tests (default)
- `list` - Show matched tags without running tests
- `init` - Create configuration files

**Options:**
- `-b, --base-branch <branch>` - Override base branch
- `-m, --mappings-file <file>` - Override mappings file path
- `-v, --verbose` - Enable verbose output
- `--no-baseline` - Exclude @baseline tests

**Examples:**

```bash
# Run with custom base branch
npx playwright-mapper --base-branch develop

# Preview what would run
npx playwright-mapper list

# Pass additional Playwright options
npx playwright-mapper -- --headed --project=chromium
```

## How It Works

1. Detects your current branch and compares it to the base branch
2. Identifies changed files using `git diff`
3. Matches changed files against your configured mappings
4. Builds a grep pattern with relevant test tags
5. Executes Playwright with the computed tag filter
6. Returns the same exit code as Playwright for CI integration

## Programmatic API

Use the library functions directly in your scripts:

```js
const { getChangedFiles, getMappedTags, computeGrepPattern } = require('playwright-mapper');

const changedFiles = getChangedFiles('main');
const tags = getMappedTags(changedFiles, './test-mappings.js');
const grepPattern = computeGrepPattern(tags);

console.log(`Running tests: ${grepPattern}`);
```

## CI Integration

### GitHub Actions

```yaml
- name: Run relevant tests
  run: npx playwright-mapper --base-branch origin/main
```

### GitLab CI

```yaml
test:
  script:
    - npx playwright-mapper --base-branch origin/main
```

### Jenkins

```groovy
sh 'npx playwright-mapper --base-branch origin/main'
```

## Safety Features

**Fallback behavior:**
- No changed files detected → runs @baseline tests only
- Configuration errors → runs all tests
- Missing mappings file → runs all tests

**Disable the mapper:**

```bash
MAPPER_DISABLE=1 npx playwright test
```

This bypasses file detection and runs your normal Playwright command.

## Why playwright-mapper?

**No configuration changes required** - Works with your existing Playwright setup without modification

**Precise test targeting** - Run only tests affected by your changes

**CI optimization** - Reduce pipeline time by skipping irrelevant tests

**Team collaboration** - Test tags and mappings serve as living documentation, helping teams understand which code affects which features

**Development tools as tests** - Write Playwright scripts for team synchronization, debugging, or exploration without worrying about them running in CI. Simply don't tag them or map them to any paths.

**Safe by default** - Falls back to running all tests if anything goes wrong

**Flexible** - Use as CLI tool or integrate programmatically

## Example Output

```bash
$ npx playwright-mapper --verbose

[mapper] Current branch: feature/auth-improvements
[mapper] Base branch: main
[mapper] Changed files:
 - src/auth/login.ts
 - src/middleware/auth.js

[mapper] Mapped test tags: @auth, @baseline
[mapper] Running: npx playwright test -g "(@auth|@baseline)"
```

## License

MIT © Ben Truthan

