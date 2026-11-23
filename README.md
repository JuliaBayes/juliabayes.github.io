# JuliaBayes

Source for <https://juliabayes.org>, built with [Quarto](https://quarto.org).

## Writing a post

1. Create a folder `news/posts/YYYY-MM-DD-slug/` containing an `index.qmd`.

1. Set up the post's own Julia environment in that folder (e.g. `julia --project=news/posts/YYYY-MM-DD-slug -e 'using Pkg; Pkg.add(...)'`).
   Commit both `Project.toml` and `Manifest.toml`.

1. Run `quarto preview` to check it, then `quarto render`.

1. Commit everything, including the new files in `_freeze/`.

Julia code should be run locally and saved in `_freeze`; it shouldn't be rerun on CI.
CI should only read from `_freeze` and render the post.

If you need to rerun the code in a post, you can delete the `_freeze/news/posts/YYYY-MM-DD-slug` folder (do _not_ delete the entire `_freeze` folder!) and rerun `quarto render`.

## Updating the community calendar

Edit [`events.json`](events.json) to add or change confirmed events. Use a
unique lowercase `id` with hyphens and include a `title`, `start`, and `updated`.
Use `YYYY-MM-DDTHH:MM:SSZ` UTC timestamps for timed events and `YYYY-MM-DD`
for date-only events. Set `end` for a known duration. Dates used as `end`
are exclusive. The optional `description` and HTTPS `url` appear in the event.

Start `sequence` at 0. Keep the same `id` when an event changes, increment
`sequence` and set `updated` to the current UTC timestamp. Set `cancelled`
to `true` to publish a cancellation.

Run `node src/community-calendar.mjs` to refresh the local `events.ics`
snapshot. Preview and publish builds regenerate it and omit completed events.
The public subscription URL stays the same, including between events.

## License

- Code, such as the theme, scripts, templates and configuration, is under the [MIT License](LICENSE).
- Content, such as the text of pages and posts and the images, is under [CC BY 4.0](LICENSE-CONTENT).

Files that carry their own licence keep it.
By contributing, you agree that your contribution is under these licences.
