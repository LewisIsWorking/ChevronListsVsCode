# Publishing Chevron Lists (VS Code)

Two ways to ship: the automated workflow (preferred) or a manual upload.

## Automated (GitHub Actions)

`.github/workflows/publish.yml` builds, tests, type-checks, packages and publishes.

### One-time setup: the `VSCE_PAT` secret

1. Sign in to <https://dev.azure.com> with the same Microsoft account that owns the
   **lewisisworking** publisher.
2. **User settings → Personal access tokens → New Token.**
   - **Organization:** *All accessible organizations* (required — a token scoped to a
     single org is rejected by the Marketplace).
   - **Scopes:** *Custom defined* → **Marketplace → Manage**.
   - **Expiration:** the maximum offered.
3. Copy the token, then store it as a repository secret:

   ```bash
   gh secret set VSCE_PAT --repo LewisIsWorking/ChevronListsVsCode
   ```

   `gh` prompts for the value and sends it straight to GitHub. **Do not paste the
   token into a shell command, a file, or a chat window** — anywhere it lands it can
   be read later. If it is ever exposed, revoke it in Azure DevOps and issue a new one.

Verify it registered (this prints only the name and date, never the value):

```bash
gh secret list --repo LewisIsWorking/ChevronListsVsCode
```

### Releasing

Test the pipeline first — **Actions → Publish → Run workflow**, leaving
*"Package only, do not publish"* ticked. That runs everything and attaches the
`.vsix` as an artifact without touching the Marketplace.

To publish for real, bump the version and push a matching tag:

```bash
# bump "version" in package.json + add a CHANGELOG entry, then:
git commit -am "Release v26.7.0"
git tag v26.7.0
git push origin master --tags
```

The workflow refuses to publish if the tag and `package.json` version disagree.

## Manual upload

Still supported, and what `release.ps1` does. Build the `.vsix`:

```powershell
bun run bundle:prod
bunx @vscode/vsce package
```

Then upload at
<https://marketplace.visualstudio.com/manage/publishers/lewisisworking>.
Browser upload uses your normal sign-in, so it needs no PAT at all.

## ⚠️ The 2026-12-01 PAT deadline

Microsoft **retires global Azure DevOps Personal Access Tokens on 1 December 2026.**
After that date `VSCE_PAT` stops working and the automated workflow needs migrating
to Microsoft Entra ID — an Azure user-assigned managed identity with workload
identity federation, authorised as a publisher contributor, published via
`vsce publish --azure-credential`. See
<https://code.visualstudio.com/api/working-with-extensions/publishing-extension>.

The manual browser upload above is unaffected, so it stays a working fallback
whatever happens to the token.

## Notes

- Publishing cannot be undone, and a **deleted extension name can never be reused**,
  even by its original publisher. Prefer *unpublish* over *delete*.
- The published version is whatever is in `package.json`; the Marketplace rejects
  re-publishing a version that already exists.
