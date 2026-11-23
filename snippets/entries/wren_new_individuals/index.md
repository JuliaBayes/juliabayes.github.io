---
title: "New individuals in a hierarchical model"
author: "Simon Steiger"
date: 2026-11-19
description: "Calculate results for hypothetical individuals by dropping parameters from your FlexiChain."
categories: [Wren, FlexiChains]
---

Fitting a hierarchical model usually locks you into parameter vectors that share dimensions with the number of individuals you work with.
Sometimes, however, you want to predict for new hypothetical individuals from the inferred population.
Here's how to do that!

```{.julia .cell-code}
using Wren, WrenDists
import Enzyme

n = 10
mu = 1.0
tau = 0.5
z = rand(Normal(), n)
theta = mu .+ tau * z
beta = [-2.0, 2.0]
site = eachindex(z)
group = repeat([1, 2], div(n, 2))
y = rand.(BernoulliLogit.(theta[site] .+ beta[group]))

@wren function hierarchical(size)
    mu ~ Normal()
    tau ~ Exponential(1)
    @iid z ~ Normal() size=size
    return mu .+ tau * z
end

@wren function logistic_regression(y, site_index, group)
    n_sites = maximum(site_index)
    n_groups = maximum(group)

    theta = (site ~ hierarchical(n_sites))
    @iid beta ~ Normal() size=n_groups
    logit_p = theta[site_index] .+ beta[group]
    for i in eachindex(y)
        y[i] ~ BernoulliLogit(logit_p[i])
    end

    @track contrast = sum(y[group .== 1]) .- sum(y[group .== 2])
end

model = logistic_regression(y, site, group)
chain = nuts(model | (; y), 1000, 4)

n_new = 200
site_new = 1:n_new
group_new = repeat([1, 2], div(n_new, 2))

# Dropping `site.z` from `chain` makes `simulate` sample from the prior
chain_sub = chain[[@vn(site.mu), @vn(site.tau)]]
model_new = logistic_regression(zeros(n_new), site_new, group_new)
chain_new = simulate(model_new, chain_sub)
```

This is explained in more detail in the Wren docs [workflow page](https://juliabayes.org/Wren.jl/dev/tutorials/workflow/).

The example runs with Julia 1.13.3. Download [Project.toml](Project.toml) and
[Manifest.toml](Manifest.toml) into the same folder. Run
`julia --project=. -e 'using Pkg; Pkg.instantiate()'` there to install the
recorded environment.
