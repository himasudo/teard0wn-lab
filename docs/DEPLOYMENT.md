# GitHub repository and Pages deployment

Target: public `himasudo/teard0wn-lab`, with the site served from `main` at the
repository root. Public visibility is appropriate for the requested free public
learning site. No existing repository is replaced, no force-push is used, and
no private user information belongs in the source.

## Existing project

The owner has created https://github.com/himasudo/teard0wn-lab. After its
**Verify lab** workflow passes, enable Pages in Settings as described below.
The bootstrap script is not needed for this existing repository.

## Bootstrap a separate new repository

Prerequisites: Python 3, Node 22+, Git, and GitHub CLI signed in as `himasudo`.
If GitHub CLI is not signed in, use its normal `gh auth login --web` flow on
your own computer. No token needs to be shared with an assistant.

From the extracted project folder:

```sh
python3 publish.py --owner YOUR_GITHUB_LOGIN --repo YOUR_NEW_REPOSITORY
```

The script:

1. Verifies local project files, account identity, and lesson/engine tests.
2. Creates the public repository, failing if that name already exists.
3. Records the exact repository ID in a local ignored recovery file.
4. Commits the explicit project file set and pushes `main` without force.
5. Waits for the exact commit’s `Verify lab` workflow, including browser tests.
6. Enables branch-based Pages only after that workflow passes.
7. Reports Pages’ returned URL/status rather than assuming a successful build.

If an attempt stops after creating the repository, preserve the folder and run:

```sh
python3 publish.py --resume
```

Resume checks repository ID and owner. It does not adopt an unrelated existing
repository. A custom domain, different origin, unexpected branch, account
mismatch, or failed CI stops publication for review. The script changes no
global Git configuration, merges no pull request, and requests no paid service.

## Browser/plugin path

If the repository is created in GitHub’s UI, initialize it with a README so
GitHub has an initial commit. The connected GitHub integration can then add
the project files in one tree/commit update. After checks pass, configure
Settings → Pages → Deploy from a branch → main → /(root).

Do not claim the site is live until GitHub reports a built deployment and an
HTTP visit confirms the intended app. A repository push alone is not a Pages
deployment.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/rest/pages/pages
