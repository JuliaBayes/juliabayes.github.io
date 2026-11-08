# Team entries

Each file in this folder adds one person to the team section of the About page.
Only add yourself. Your entry is there because you chose to add it.

1. Copy the example below into `<github-handle>.yml` in this folder.
1. Add a square image as `<github-handle>.jpg` or `.png`, about 200 by 200 pixels.
   To use your GitHub avatar, save `https://github.com/<github-handle>.png?size=200`.
   The site serves the photo itself, so visitors' browsers do not contact GitHub.
1. Open a pull request.

To leave the page, delete your files.

```yaml
name: Jane Doe                       # required
github: janedoe                      # required
role: Maintainer                     # required
order: 10                            # required, position on the page, lowest first
image: janedoe.jpg                   # optional, file name in this folder
pronouns: she/her                    # optional
affiliation: University of Example   # optional
bio: One or two sentences about you. # optional
packages: [FlexiChains.jl, VarNames.jl] # optional, JuliaBayes repository names
website: https://janedoe.org         # optional
email: jane@example.org              # optional, shown publicly
```
