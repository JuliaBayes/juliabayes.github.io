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

## Writing a gist

1. Copy [the gist template](gists/_template.md) to `gists/entries/YYYY-MM-DD-slug/index.md`.
1. Fill in the title, author, date, summary, and tags. Add Julia code you have run. Use `{.julia .cell-code}` on fenced blocks for syntax highlighting and folding.
1. Add any saved output, figures, or source links. Keep assets next to `index.md`. Code-only gists are welcome.
1. Render with `quarto render gists/` and open a PR with the Markdown and assets.

Gists use Quarto's Markdown engine with execution disabled. Include code and results as static content.

## License

- Code, such as the theme, scripts, templates and configuration, is under the [MIT License](LICENSE).
- Content, such as the text of pages and posts and the images, is under [CC BY 4.0](LICENSE-CONTENT).

Files that carry their own licence keep it.
By contributing, you agree that your contribution is under these licences.
