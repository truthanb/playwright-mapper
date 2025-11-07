# 🎯 playwright-mapper  
**Run only the Playwright tests that matter.**  

`playwright-mapper` detects changed files in your branch, maps them to related test tags, and runs only the relevant Playwright tests.  
Save time, reduce flakiness, and keep CI feedback blazing fast — all without touching your existing Playwright config.  

---

## 🚀 Installation

```bash
npm install -D playwright-mapper
# or
yarn add -D playwright-mapper
```

---

## ⚙️ Quick Start

### 1. Keep your existing Playwright config
No imports. No wrappers. No magic.

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: 'html',
  testDir: './tests',
});
```

### 2. Create your test mappings
```js
// test-mappings.js
export default {
  "@checkout": ["src/checkout/", "apps/checkout/"],
  "@returns": ["src/returns/"],
  "@orders": ["src/orders/", "app/Http/Controllers/OrderController.php"],
};
```

### 3. Run your tests with mapper
```bash
npx playwright-mapper
```

This will:
1. Detect your current branch (e.g. `feature/add-returns-flow`)
2. Diff it against your base branch (`main` by default)
3. Match changed files against your mappings
4. Build a grep pattern like `(@checkout|@returns|@mainRegression)`
5. Call Playwright internally to run only those matching tests

---

## 🧩 Configuration Options

You can create a `.mapperrc.json` or pass flags to the CLI.

| Option | Type | Default | Description |
|--------|------|----------|-------------|
| `mappingsFile` | `string` | `"test-mappings.js"` | Path to your mapping file |
| `baseBranch` | `string` | `"main"` | Branch or commit to diff against |
| `addBaseline` | `boolean` | `true` | Always include `@baseline` in the grep |
| `verbose` | `boolean` | `false` | Print detailed info before running |

Example `.mapperrc.json`:
```json
{
  "mappingsFile": "test-mappings.js",
  "baseBranch": "develop",
  "addBaseline": true,
  "verbose": true
}
```

---

## 🧪 CLI Commands

| Command | Description |
|----------|-------------|
| `npx playwright-mapper` | Default behavior: detect changes, map tags, and run Playwright tests |
| `npx playwright-mapper run` | Alias for the default command |
| `npx playwright-mapper init` | Creates a sample `test-mappings.js` and `.mapperrc.json` |
| `npx playwright-mapper list` | Prints changed files and resolved test tags without running tests |

---

## 🧠 How It Works

1. Detects your current branch via `git rev-parse --abbrev-ref HEAD`.  
2. Runs `git diff --name-only main...HEAD` (or your configured base branch).  
3. Compares changed files against your configured mappings.  
4. Builds a regex pattern combining relevant test tags.  
5. Calls:
   ```bash
   npx playwright test -g "(@checkout|@returns|@mainRegression)"
   ```
6. Exits with the same status code as Playwright.

---

## 🧩 Optional Programmatic API

If you prefer to wire it into your own logic or CI script:

```js
import { getChangedFiles, getMappedTags, computeGrepPattern } from 'playwright-mapper';

const changed = getChangedFiles('main');
const tags = getMappedTags(changed, './test-mappings.js');
const grepPattern = computeGrepPattern(tags);

console.log(`Detected test tags: ${tags.join(', ')}`);
console.log(`Run with: npx playwright test -g "${grepPattern}"`);
```

Or inside your Playwright config if you *want* to opt in:
```ts
import { defineConfig } from '@playwright/test';
import { computeGrepPattern } from 'playwright-mapper';
import mappings from './test-mappings.js';

export default defineConfig({
  grep: computeGrepPattern({ mappings }),
});
```

---

## 🧩 CI Integration Example

```yaml
run_playwright_tests:
  stage: test
  script:
    - npx playwright-mapper --base-branch origin/main
```

---

## 🟡 Fallbacks and Safety

- If no changed files are detected → runs the `@mainRegression` tag by default.  
- If mapping fails or config is missing → falls back to running **all tests**.  
- You can temporarily bypass the mapper entirely:  
  ```bash
  MAPPER_DISABLE=1 npx playwright test
  ```

---

## 🛰️ Why This Approach?

| Goal | How It’s Achieved |
|------|-------------------|
| **Low friction** | Works with any existing Playwright project, no config wrapping |
| **Zero lock-in** | Just uninstall it — your setup stays intact |
| **Composable** | CLI or API, your choice |
| **Safe** | No config mutation, no implicit test filtering |
| **Fast** | Reduces CI runtime by running only relevant tests |

---

## 🦯 Future Roadmap

- 🔁 Support for Jest/Vitest (test-agnostic mode)  
- 🧩 Automatic coverage-based mapping (learns from previous runs)  
- ☁️ CI summary reporter (PR comment with what was skipped/run)  
- 🔄 “Learning mode” to suggest new mappings based on real test runs  

---

## 🧮 Example Folder Structure

```
my-app/
├── playwright.config.ts
├── tests/
│   ├── checkout.spec.ts
│   ├── returns.spec.ts
│   ├── products.spec.ts
├── test-mappings.js
└── .mapperrc.json
```

---

## 👨‍💻 Example Output

```bash
$ npx playwright-mapper

[mapper] Branch: feature/returns-policy
[mapper] Base: main
[mapper] Changed files:
 - src/returns/ReturnsPage.tsx
 - src/api/ReturnsService.ts

[mapper] Mapped test tags: @returns, @mainRegression
[mapper] Running tests with: npx playwright test -g "(@returns|@mainRegression)"
```

---

## 🔧 License
MIT © 2025 Ben Truthan

