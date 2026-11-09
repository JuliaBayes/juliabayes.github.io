# Package entries

Add packages to `packages.yml`. The repository link defaults to
`https://github.com/JuliaBayes/<package name>`; set `repository` to override it.

Add an object with `"release-package": "PackageName.jl"` to `releases.yml`, then
run `node src/package-releases.mjs` from the project root. This uses your GitHub
CLI login to fetch the latest release, excluding drafts and prereleases.

`releases.yml` uses JSON syntax, which is valid YAML. Commit the snapshot so
local renders work offline. Preview and publish builds refresh it, and the
publish workflow runs daily. API errors fail the update without replacing the
snapshot. Packages without a stable GitHub release show that explicitly.
