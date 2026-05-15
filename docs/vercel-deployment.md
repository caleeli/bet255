# Vercel frontend deployment

The frontend lives in `frontend/` and builds with Vite. The root `vercel.json` tells Vercel to install and build that folder, then publish `frontend/dist`.

## Automatic deployment

`.github/workflows/vercel-frontend.yml` deploys the frontend to Vercel when a pull request is merged into `main` or `master`. GitHub emits that merge as a `push` event to the target branch, so the workflow intentionally runs on protected production branches instead of on every pull request update.

You can also run the workflow manually from GitHub Actions with `workflow_dispatch`.

## GitHub repository configuration

Configure these values in **Settings → Secrets and variables → Actions**:

### Secrets

- `VERCEL_TOKEN`: a Vercel access token with permission to deploy the project.

### Variables

- `VERCEL_ORG_ID`: the Vercel team or user ID that owns the project.
- `VERCEL_PROJECT_ID`: the Vercel project ID for this frontend.

To find the IDs locally after linking the project, run:

```bash
vercel link
cat .vercel/project.json
```

Do not commit `.vercel/project.json`; keep those IDs in GitHub Actions variables instead.
