# HandyHive website — GitHub Pages version

This folder is ready for **GitHub Pages**. It has no server dependencies, npm install, or build step.

## Publish to GitHub

1. Create or open the GitHub repository that hosts the HandyHive website. If you have a custom domain, keep its existing `CNAME` file and related configuration.
2. Upload **the contents of this folder** to the root of that repository. Make sure the repository includes `index.html`, `admin/index.html`, `assets/admin.js`, `assets/media.json`, and `assets/uploads/.gitkeep`.
3. The root `admin.html` is now a compatibility redirect to the actual admin page at `admin/index.html`, so existing bookmarks will still work. Do not replace `admin/index.html` with `admin.html`.
4. In the repository's **Settings → Pages**, select **Deploy from a branch**, then the default branch (usually `main`) and the **/(root)** folder. Save.
5. Open the published homepage. For a GitHub Pages project site, it generally looks like `https://USERNAME.github.io/REPOSITORY/`. For an account site, `https://USERNAME.github.io/`. For custom domains, use your configured domain.
6. The private management *route* is `YOUR_WEBSITE_URL/admin/`. Visiting `/admin` on GitHub Pages normally redirects to `/admin/`. For project sites, retain the `/REPOSITORY/` prefix.

## Set up image publishing

GitHub Pages does not accept direct file uploads by itself. The management page uses GitHub's authenticated Contents API to commit updates to the repository, so published images persist and are visible to everyone.

1. In GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Choose the owner and **only the website repository** in Repository access.
3. Grant **Repository permissions → Contents → Read and write** (Metadata read access is supplied automatically).
4. Set a short expiry and create the token. Keep it confidential.
5. Open the site's `/admin/` route. Enter repository owner, repository name, and your token, then select **Connect securely**. On `github.io` URLs, owner/repo usually auto-fill.
6. Select logo, hero, gallery photo, or service photo; upload a picture and choose **Publish image**.
7. The panel commits `assets/uploads/<position>.webp` and updates `assets/media.json`. After GitHub Pages deploys the new commit, **all visitors** will see the same image. You may need to refresh their pages to view changes.

**Security:** The admin screen is unlinked and marked `noindex`, but **it is NOT password-protected** and anyone who knows its address can open the login form. Making an admin page invisible does not provide access control. GitHub rejects any write request without an authorised token. The admin code keeps the entered token in memory only; it is never committed to GitHub or persisted in storage. For a fully access-restricted `/admin` page, you must use hosting with authentication/access-control (such as an identity-aware proxy or a proper server-side login), not GitHub Pages alone.

**Do not add your GitHub token to HTML, JavaScript, environment files committed to a public repository, or screenshot it for sharing.** The content API can modify code as well as images within the selected repository. Use the narrowest repository access and a short expiry. The browser must trust the deployed JavaScript code and extensions to keep the token safe.

## Import browser-only images from the previous version

The original site used browser IndexedDB. Those images did not publish to other visitors. On the **same site URL and browser** as the old version, connect to GitHub and click **Import previous browser images**. This reads the old browser storage and commits each old image to GitHub. If you used multiple browsers, perform the import from the browser that contains your original uploads. Browsers do not share these local files.

## File layout

```
index.html                  Public homepage (no admin button)
admin/index.html            Administration interface: /admin/
admin.html                  Redirect from older /admin.html URL
assets/admin.js             GitHub API image upload/publishing logic
assets/media.json           Public manifest for saved image locations
assets/uploads/             Persistent image files saved by the admin
.nojekyll                   Disable Jekyll processing
```

## Limitations and troubleshooting

- The GitHub Pages site must be configured to publish **from a branch** containing these files. If it uses a custom Actions build, make sure commits to the content branch trigger deployment and that the build copies `assets/media.json` and `assets/uploads/`.
- GitHub Pages publishes changes asynchronously. Wait for the new deployment to finish under the repository's **Actions** tab before testing in a new/incognito browser.
- A `404` for `assets/media.json` means the file was not uploaded or you entered the wrong repository/branch.
- A `403` or `404` on publishing often means the access token has insufficient access to the repository or Contents read/write permission.
- Upload supports JPG, PNG and WebP up to 5 MB each; the browser resizes the longest dimension to at most 2,000 pixels and converts the result to WebP.
- Removing an image removes the manifest entry, but does not rewrite past Git commits. The uploaded file can still exist at its direct URL and in Git history.
- This setup saves published media in Git, so frequent updates increase repository history size over time. A dedicated image storage service may be preferable for heavy daily uploads.

### Upload using Git command line (optional)

From a local clone of your repository, copy the contents of this folder into the repository root, then run:

```bash
git add -A
git commit -m "Fix admin route and persist published images"
git push
```

Preserve any existing custom-domain `CNAME` or other intentional repository files.

## Why clicking Connect previously cleared the form

The original uploaded `admin.html` was located in the repository root while its `../assets/admin.js` path assumes the admin HTML file is located in the `/admin/` folder. When the JavaScript does not load, the form submits normally and the page can reload and clear the input fields. The corrected structure places `admin/index.html` beside the intended assets directory and provides an `admin.html` compatibility redirect. If connection still fails, read the status message below the form: the GitHub API may be denying access or `assets/media.json` may not yet exist in the connected repository.
