# ATLAS 2.0 (static edition for GitHub Pages)

Enterprise Application Governance Platform: application portfolio and technology lifecycle reporting that runs **entirely in the browser**. There is no server, database or sign-in. Your data stays in the browser that opens the page.

## Publish on GitHub Pages

**Option A: no build step (simplest).** The `docs/` folder is already built.
1. Create a repository and push this whole folder to the `main` branch.
2. Settings, Pages, Source: **Deploy from a branch**, branch `main`, folder `/docs`.
3. Open `https://<user>.github.io/<repo>/`.

**Option B: build in GitHub Actions.**
1. Push this folder to `main`.
2. Settings, Pages, Source: **GitHub Actions**. The workflow in `.github/workflows/pages.yml` installs, runs the tests, builds and deploys.

The site uses relative paths and `#/` routes, so it works under a repository sub-path and deep links survive a refresh.

## Use it
1. Open **Datasets**, download the template, fill the Inventory sheet (the TechStack sheet is a starter catalogue).
2. Choose the workbook, **Preview and validate**, then **Run Report**. Each run replaces all data in the workspace.
3. Dashboard, Executive view, Applications, Instances and Technologies update from the run.

The workspace starts with generated demonstration data. **Datasets, Workspace** lets you export a JSON backup, restore one, or reset to the demo.

## Differences from the full (Docker) edition
- **No sign-in.** The "Viewing as" selector simulates the six roles so you can try the permissions and the sign-off workflow. It is not security.
- **Data is per browser.** Nothing is shared between people. Use the backup file to move a workspace. Browser storage holds roughly 5 MB, which is several thousand components.
- **The audit trail is local.** It is hash-chained, but a user with developer tools can edit their own copy.
- **Exports are CSV.** The older three-template Excel import is replaced by the Dataset import.
- Needs a current browser (Chrome, Edge, Firefox 113+, Safari 16.4+).

## Privacy
A Pages site is public by default (private Pages needs a paid GitHub plan). The code and the template are public, but a workbook you load is read in your browser and never uploaded. Do not commit real inventory files to the repository.

## Develop
```
npm install
npm start        # http://localhost:8080, rebuilds on change
npm test         # unit tests of the import engine
npm run build    # writes ./docs
npm run e2e      # browser tests (needs: npm i -D playwright, then npx playwright install chromium)
```
Add `?today=2026-11-13` to the address to pin the reporting date for demos and tests.
The starter TechStack catalogue is `src/data/techstack.json`. Its dates are recalled from vendor policies and are marked NEEDS VERIFICATION; check each against its URL.
