# Changesets

Every pull request that changes a published package (`packages/*`) carries a changeset: a short
Markdown file saying which packages change, how (patch, minor, major) and why, in one sentence a
consumer understands. Create one with:

```sh
pnpm changeset
```

A release branch then runs `pnpm release:version`, which bumps the versions and writes each
package's `CHANGELOG.md`; once merged into `dev`, the Packages workflow publishes the new versions
(decision 0006). The apps are private: they are never versioned nor published.
