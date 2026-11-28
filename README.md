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

For a technical post you want readers to cite, include its title, author, and
publication date in the front matter. Add `citation: true` and
`google-scholar: true` to include citation metadata in the page header.

If you need to rerun the code in a post, you can delete the `_freeze/news/posts/YYYY-MM-DD-slug` folder (do _not_ delete the entire `_freeze` folder!) and rerun `quarto render`.

## Updating the community calendar

Edit [`events.yml`](events.yml) to add or change confirmed events. Use a
unique lowercase `id` with hyphens and include a `title`, `start`, and `updated`.
Use `YYYY-MM-DDTHH:MM:SSZ` UTC timestamps for timed events and `YYYY-MM-DD`
for date-only events. Set `end` for a known duration. Dates used as `end`
are exclusive. The optional `description`, HTTPS `url` for details, and
HTTPS `meeting-url` for joining appear in the event.

Start `sequence` at 0. Keep the same `id` when an event changes, increment
`sequence` and set `updated` to the current UTC timestamp. Set `cancelled`
to `true` to publish a cancellation.

The landing page shows the next event that has not ended in a box with its
details. With no such event, the box is not shown. The daily publish build
refreshes the box, and a script in the page removes it once the event ends.

Run `npm ci` once, then `node src/community-calendar.mjs` to refresh the local
`events.ics` snapshot. Preview and publish builds regenerate it. Keep past events in the
file as a record. The public subscription URL stays the same.

Open a PR against `main` with the [calendar event template](.github/PULL_REQUEST_TEMPLATE/calendar-event.md).
Set `template=calendar-event.md` in the GitHub compare URL. From the CLI, use
`gh pr create --base main --template .github/PULL_REQUEST_TEMPLATE/calendar-event.md`.

## License

- Code, such as the theme, scripts, templates and configuration, is under the [MIT License](LICENSE).
- Content, such as the text of pages and posts and the images, is under [CC BY 4.0](LICENSE-CONTENT).

Files that carry their own licence keep it.
By contributing, you agree that your contribution is under these licences.
