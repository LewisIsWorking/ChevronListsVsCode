# Publishing Chevron Lists (VS Code)

Releases are uploaded **by hand**. There is no `VSCE_PAT` secret, by choice: the
token route needs an Azure DevOps organisation, and after 2026-12-01 a paid Azure
subscription (see the deadline below). The automated workflow still runs on every
tag, but without the secret it only builds and attaches the `.vsix`.

## Release checklist

1. On a branch: bump `version` in `package.json`, add the CHANGELOG entry, run
   `bun run bundle:prod` and commit the rebuilt `dist/extension.js`. PR, green CI,
   squash-merge.
2. From an up-to-date `master`, package it:

   ```powershell
   .\node_modules\.bin\vsce.exe package --no-dependencies --out chevron-lists-X.Y.Z.vsix
   ```

3. **List the package before uploading** (`unzip -l`): the manifest version must
   be X.Y.Z, and nothing but user-facing files may be in it. `.vscodeignore` once
   let draft marketing posts ship to every user.
4. Upload at <https://marketplace.visualstudio.com/manage/publishers/lewisisworking>:
   *⋯ → Update*, pick the `.vsix`, answer the captcha.
5. Confirm the marketplace shows X.Y.Z, then tag the commit that shipped:
   `git tag -a vX.Y.Z -m "Chevron Lists X.Y.Z" && git push origin vX.Y.Z`.
   The Publish workflow then passes without publishing.

## Automated (GitHub Actions), if a token is ever added

`.github/workflows/publish.yml` builds, tests, type-checks, packages and publishes.

### One-time setup: the `VSCE_PAT` secret

1. Sign in to <https://dev.azure.com> with the same Microsoft account that owns the
   **lewisisworking** publisher.
2. **User settings → Personal access tokens → New Token.**
   - **Organization:** *All accessible organizations* (required - a token scoped to a
     single org is rejected by the Marketplace).
   - **Scopes:** *Custom defined* → **Marketplace → Manage**.
   - **Expiration:** the maximum offered.
3. Copy the token, then store it as a repository secret:

   ```bash
   gh secret set VSCE_PAT --repo LewisIsWorking/ChevronListsVsCode
   ```

   `gh` prompts for the value and sends it straight to GitHub. **Do not paste the
   token into a shell command, a file, or a chat window** - anywhere it lands it can
   be read later. If it is ever exposed, revoke it in Azure DevOps and issue a new one.

Verify it registered (this prints only the name and date, never the value):

```bash
gh secret list --repo LewisIsWorking/ChevronListsVsCode
```

### Releasing

Test the pipeline first - **Actions → Publish → Run workflow**, leaving
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

## ⚠️ The 2026-12-01 PAT deadline

Microsoft **retires global Azure DevOps Personal Access Tokens on 1 December 2026.**
After that date `VSCE_PAT` stops working and the automated workflow needs migrating
to Microsoft Entra ID - an Azure user-assigned managed identity with workload
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
