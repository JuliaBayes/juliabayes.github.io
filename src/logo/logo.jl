using GLMakie
using Distributions
using LinearAlgebra
using Random

const JULIA_COLOURS = Colors.JULIA_LOGO_COLORS

# Green on top, purple bottom-left, red bottom-right, as in the Julia logo.
function julia_logo_components(; radius=1.0, σ=0.45)
    angles = (90, 210, 330)
    return [MvNormal(radius .* [cosd(a), sind(a)], σ^2 * I) for a in angles]
end

## Target density: equally weighted mixture of the three components

function component_logpdfs(components, θ)
    return [logpdf(c, θ) for c in components]
end

function logdensity(components, θ)
    lps = component_logpdfs(components, θ)
    m = maximum(lps)
    return m + log(sum(exp.(lps .- m)))
end

function gradlogdensity(components, θ)
    lps = component_logpdfs(components, θ)
    weights = exp.(lps .- maximum(lps))
    weights ./= sum(weights)
    return sum(w * gradlogpdf(c, θ) for (w, c) in zip(weights, components))
end

## No-U-Turn sampler (Hoffman & Gelman 2014, Algorithm 3) recording every leapfrog step

const MAX_ENERGY_ERROR = 1000.0

"""
Leapfrog positions of one NUTS iteration. `positions[k]` is the position `k` steps
along the Hamiltonian flow from the starting point, for `k` in `leftmost:rightmost`.
Negative `k` is backwards in time, and `positions[0]` is the starting point.
"""
struct NUTSIteration
    positions::Dict{Int,Vector{Float64}}
    leftmost::Int
    rightmost::Int
    sample::Vector{Float64}
end

sample_index(it::NUTSIteration) =
    only(k for k in it.leftmost:it.rightmost if it.positions[k] === it.sample)

"Leapfrog positions along the Hamiltonian flow from the starting point to `positions[k]`."
function path_along_orbit(it::NUTSIteration, k)
    step = k < 0 ? -1 : 1
    return [it.positions[j] for j in 0:step:k]
end

path_to_sample(it::NUTSIteration) = path_along_orbit(it, sample_index(it))

mutable struct LeapfrogRecorder
    positions::Dict{Int,Vector{Float64}}
    leftmost::Int
    rightmost::Int
end

LeapfrogRecorder(θ) = LeapfrogRecorder(Dict(0 => θ), 0, 0)

# Within one doubling all leapfrog steps move outwards from the same end of the orbit.
function record!(recorder::LeapfrogRecorder, θ, direction)
    if direction == 1
        recorder.rightmost += 1
        recorder.positions[recorder.rightmost] = θ
    else
        recorder.leftmost -= 1
        recorder.positions[recorder.leftmost] = θ
    end
    return recorder
end

function leapfrog(components, θ, r, ε)
    r_half = r + ε / 2 * gradlogdensity(components, θ)
    θ_next = θ + ε * r_half
    r_next = r_half + ε / 2 * gradlogdensity(components, θ_next)
    return θ_next, r_next
end

joint_logdensity(components, θ, r) = logdensity(components, θ) - dot(r, r) / 2

no_uturn(θ_minus, θ_plus, r_minus, r_plus) =
    dot(θ_plus - θ_minus, r_minus) >= 0 && dot(θ_plus - θ_minus, r_plus) >= 0

function build_tree(rng, components, recorder, θ, r, log_slice, direction, depth, ε)
    if depth == 0
        θ_next, r_next = leapfrog(components, θ, r, direction * ε)
        record!(recorder, θ_next, direction)
        joint = joint_logdensity(components, θ_next, r_next)
        n_valid = Int(log_slice <= joint)
        keep_going = log_slice < joint + MAX_ENERGY_ERROR
        return θ_next, r_next, θ_next, r_next, θ_next, n_valid, keep_going
    end

    θ_minus, r_minus, θ_plus, r_plus, θ_proposal, n_valid, keep_going =
        build_tree(rng, components, recorder, θ, r, log_slice, direction, depth - 1, ε)
    keep_going || return θ_minus, r_minus, θ_plus, r_plus, θ_proposal, n_valid, keep_going

    if direction == -1
        θ_minus, r_minus, _, _, θ_subproposal, n_subvalid, sub_keep_going = build_tree(
            rng,
            components,
            recorder,
            θ_minus,
            r_minus,
            log_slice,
            direction,
            depth - 1,
            ε,
        )
    else
        _, _, θ_plus, r_plus, θ_subproposal, n_subvalid, sub_keep_going = build_tree(
            rng,
            components,
            recorder,
            θ_plus,
            r_plus,
            log_slice,
            direction,
            depth - 1,
            ε,
        )
    end
    n_total = n_valid + n_subvalid
    if n_total > 0 && rand(rng) < n_subvalid / n_total
        θ_proposal = θ_subproposal
    end
    keep_going = sub_keep_going && no_uturn(θ_minus, θ_plus, r_minus, r_plus)
    return θ_minus, r_minus, θ_plus, r_plus, θ_proposal, n_total, keep_going
end

function nuts_iteration(rng, components, θ, ε; max_depth=8)
    r = randn(rng, length(θ))
    log_slice = joint_logdensity(components, θ, r) + log(rand(rng))
    recorder = LeapfrogRecorder(θ)
    θ_minus, θ_plus, r_minus, r_plus = θ, θ, r, r
    sample = θ
    n_valid = 1
    keep_going = true
    depth = 0
    while keep_going && depth < max_depth
        direction = rand(rng, (-1, 1))
        if direction == -1
            θ_minus, r_minus, _, _, θ_proposal, n_subvalid, sub_keep_going = build_tree(
                rng,
                components,
                recorder,
                θ_minus,
                r_minus,
                log_slice,
                direction,
                depth,
                ε,
            )
        else
            _, _, θ_plus, r_plus, θ_proposal, n_subvalid, sub_keep_going = build_tree(
                rng,
                components,
                recorder,
                θ_plus,
                r_plus,
                log_slice,
                direction,
                depth,
                ε,
            )
        end
        if sub_keep_going && rand(rng) < n_subvalid / n_valid
            sample = θ_proposal
        end
        n_valid += n_subvalid
        keep_going = sub_keep_going && no_uturn(θ_minus, θ_plus, r_minus, r_plus)
        depth += 1
    end
    return NUTSIteration(recorder.positions, recorder.leftmost, recorder.rightmost, sample)
end

## Closed chain paths

"""
A closed NUTS chain: it moves continuously along each iteration's Hamiltonian flow from
its starting point to its sample, and returns to its first point after `length(points)`
steps. Index `length(points) + 1` is index 1 again. `sample_indices` are the indices in
`points` at which a sample is drawn.
"""
struct LoopingChain
    points::Vector{Point2f}
    sample_indices::Vector{Int}
end

Base.length(chain::LoopingChain) = length(chain.points)
cyclic_index(chain::LoopingChain, k) = mod1(k, length(chain))

catmull_rom(p0, p1, p2, p3, t) =
    0.5f0 *
    (2p1 + (p2 - p0) * t + (2p0 - 5p1 + 4p2 - p3) * t^2 + (3p1 - p0 - 3p2 + p3) * t^3)

"""
Uniform Catmull–Rom spline through the closed path `points`, with `substeps` points per
interval. Point `i` of the input is point `(i - 1) * substeps + 1` of the output.
"""
function smooth_closed_curve(points, substeps)
    n = length(points)
    at(i) = points[mod1(i, n)]
    return [
        catmull_rom(at(i - 1), at(i), at(i + 1), at(i + 2), Float32(s / substeps)) for
        i in 1:n for s in 0:(substeps-1)
    ]
end

"""
The closed path `points` with the corner at each of `corner_indices` replaced by a
quadratic Bézier curve from `corner_steps` points before the corner to `corner_steps`
points after it, with the corner as control point. Neighbouring corners shorten each
other's curves so that the curves never overlap.
"""
function round_corners(points, corner_indices; corner_steps)
    n = length(points)
    at(i) = points[mod1(i, n)]
    corners = sort(corner_indices)
    rounded = copy(points)
    for (j, c) in pairs(corners)
        gap_before = mod(c - corners[mod1(j - 1, length(corners))], n)
        gap_after = mod(corners[mod1(j + 1, length(corners))] - c, n)
        gap_before == 0 && (gap_before = n)
        gap_after == 0 && (gap_after = n)
        m = min(corner_steps, gap_before ÷ 2, gap_after ÷ 2)
        m >= 1 || continue
        p0, p1, p2 = at(c - m), at(c), at(c + m)
        for k in (-m):m
            t = Float32((k + m) / 2m)
            rounded[mod1(c + k, n)] = (1 - t)^2 * p0 + 2t * (1 - t) * p1 + t^2 * p2
        end
    end
    return rounded
end

"""
`LoopingChain` through the closed path of leapfrog positions `leapfrogs`, with rounded
corners at the samples and `substeps` smoothed points per leapfrog step.
"""
function closed_chain(leapfrogs, sample_indices; substeps, corner_steps)
    rounded = round_corners(leapfrogs, sample_indices; corner_steps)
    points = smooth_closed_curve(rounded, substeps)
    return LoopingChain(points, [(k - 1) * substeps + 1 for k in sample_indices])
end

"""
Shift `orbit_segment` linearly along its length so that it ends exactly at `target`,
leaving its first point in place.
"""
function bend_towards(orbit_segment, target)
    offset = target - last(orbit_segment)
    n_steps = length(orbit_segment) - 1
    return [θ + offset * (j / n_steps) for (j, θ) in zip(0:n_steps, orbit_segment)]
end

closest_orbit_index(it::NUTSIteration, target) =
    argmin(k -> norm(it.positions[k] - target), setdiff(it.leftmost:it.rightmost, 0))

"""
Up to `attempts` independent NUTS iterations from `θ`. Returns the first iteration whose
orbit passes within `tolerance` of `target`, with the index of its closest orbit point,
or `nothing`.
"""
function find_closing_iteration(rng, components, θ, target, ε; tolerance, attempts)
    for _ in 1:attempts
        iteration = nuts_iteration(rng, components, θ, ε)
        k = closest_orbit_index(iteration, target)
        norm(iteration.positions[k] - target) < tolerance && return iteration, k
    end
    return nothing
end

"""
Run NUTS from `origin` for at least `min_steps` leapfrog steps. From then on, before
each regular iteration, up to `closing_attempts` independent iterations are tried from
the current state; the first whose orbit passes within `tolerance` of `origin` closes
the loop, taking the closest orbit point as its sample, bent onto `origin`.
"""
function LoopingChain(
    rng,
    components,
    origin,
    ε;
    min_steps,
    max_steps,
    substeps,
    corner_steps,
    tolerance,
    closing_attempts,
)
    leapfrogs = [Point2f(origin)]
    sample_indices = [1]
    θ = origin
    while length(leapfrogs) < max_steps
        if length(leapfrogs) >= min_steps
            closing = find_closing_iteration(
                rng,
                components,
                θ,
                origin,
                ε;
                tolerance,
                attempts=closing_attempts,
            )
            if !isnothing(closing)
                iteration, k = closing
                closing_orbit = bend_towards(path_along_orbit(iteration, k), origin)
                append!(leapfrogs, Point2f.(closing_orbit[2:(end-1)]))
                return closed_chain(
                    leapfrogs,
                    unique(sample_indices);
                    substeps,
                    corner_steps,
                )
            end
        end
        iteration = nuts_iteration(rng, components, θ, ε)
        append!(leapfrogs, Point2f.(path_to_sample(iteration)[2:end]))
        push!(sample_indices, lastindex(leapfrogs))
        θ = iteration.sample
    end
    error(
        "chain did not return to within $tolerance of $origin in $max_steps steps; " *
        "try another seed, a larger tolerance or more closing attempts",
    )
end

"""
`chain` traversed at constant relative speed so that the loop takes `n_points` steps,
by linear interpolation between neighbouring points.
"""
function resample(chain::LoopingChain, n_points)
    steps_per_point = length(chain) / n_points
    function point_at(t)
        i = floor(Int, t)
        f = Float32(t - i)
        return (1 - f) * chain.points[cyclic_index(chain, i + 1)] +
               f * chain.points[cyclic_index(chain, i + 2)]
    end
    points = [point_at((j - 1) * steps_per_point) for j in 1:n_points]
    sample_indices = unique(
        mod1(round(Int, (k - 1) / steps_per_point) + 1, n_points) for
        k in chain.sample_indices
    )
    return LoopingChain(points, sample_indices)
end

"""
One looping NUTS chain per entry of `origins`, each resampled so that all return to their
origin after the same number of steps: their mean loop length, rounded to a multiple of
`loop_multiple`. Also returns each chain's speed relative to the sampler's own.
"""
function synchronised_chains(rng, components, origins, ε; loop_multiple, kwargs...)
    loops = [LoopingChain(rng, components, origin, ε; kwargs...) for origin in origins]
    n_points = loop_multiple * round(Int, mean(length.(loops)) / loop_multiple)
    return [resample(l, n_points) for l in loops], length.(loops) ./ n_points
end

## Animation

"""
Comet with its head at step `head` of `chain`: the last `tail_length` points, fading from
`max_alpha` and narrowing towards the back, wrapping around the end of the loop.
"""
function comet(chain::LoopingChain, colour, head; tail_length, max_linewidth, max_alpha)
    tail_length <= length(chain) || throw(
        ArgumentError("tail_length $tail_length exceeds the loop length $(length(chain))"),
    )
    steps_back = (tail_length-1):-1:0
    indices = [cyclic_index(chain, head - s) for s in steps_back]
    closeness_to_head = [1 - s / tail_length for s in steps_back]
    return (;
        points=chain.points[indices],
        colours=[RGBAf(colour, max_alpha * t^2) for t in closeness_to_head],
        linewidths=max_linewidth .* closeness_to_head,
    )
end

"""
Samples drawn within `lifetime` steps before step `head`, as twinkling stars. Each star
flares up at `max_size`, its colour mixed towards white by `max_whiteness`, on a glow
`glow_scale` times its size; it then shrinks, turns by up to `max_turn` and fades.
Wraps around the end of the loop.
"""
function twinkles(
    chain::LoopingChain,
    colour,
    head;
    lifetime,
    max_size,
    max_whiteness,
    max_turn,
    glow_scale,
    glow_alpha,
)
    points = Point2f[]
    star_sizes = Float32[]
    star_colours = RGBAf[]
    rotations = Float32[]
    glow_sizes = Float32[]
    glow_colours = RGBAf[]
    for k in chain.sample_indices
        age = mod(head - k, length(chain))
        age < lifetime || continue
        brightness = 1 - age / lifetime
        core = Colors.weighted_color_mean(
            max_whiteness * brightness^2,
            colorant"white",
            colour,
        )
        push!(points, chain.points[k])
        push!(star_sizes, max_size * brightness^1.5)
        push!(star_colours, RGBAf(core, brightness))
        push!(rotations, max_turn * (1 - brightness))
        push!(glow_sizes, glow_scale * max_size * brightness)
        push!(glow_colours, RGBAf(colour, glow_alpha * brightness^2))
    end
    return (; points, star_sizes, star_colours, rotations, glow_sizes, glow_colours)
end

"""
Draw one chain's comet and twinkling samples in `colour`. Returns a function that moves
them to step `head`.
"""
function draw_chain!(ax, chain, colour; comet_style, twinkle_style)
    trail = Observable(comet(chain, colour, 1; comet_style...))
    lines!(
        ax,
        lift(c -> c.points, trail);
        color=lift(c -> c.colours, trail),
        linewidth=lift(c -> c.linewidths, trail),
    )

    stars = Observable(twinkles(chain, colour, 1; twinkle_style...))
    scatter!(
        ax,
        lift(s -> s.points, stars);
        marker=:circle,
        color=lift(s -> s.glow_colours, stars),
        markersize=lift(s -> s.glow_sizes, stars),
    )
    scatter!(
        ax,
        lift(s -> s.points, stars);
        marker=:star4,
        color=lift(s -> s.star_colours, stars),
        markersize=lift(s -> s.star_sizes, stars),
        rotation=lift(s -> s.rotations, stars),
    )

    return function move_to!(head)
        trail[] = comet(chain, colour, head; comet_style...)
        stars[] = twinkles(chain, colour, head; twinkle_style...)
    end
end

function shift_lightness(colour, Δ)
    lab = convert(Colors.Lab, colour)
    rgb = convert(Colors.RGB{Float32}, Colors.Lab(lab.l + Δ, lab.a, lab.b))
    return RGBf(clamp(rgb.r, 0, 1), clamp(rgb.g, 0, 1), clamp(rgb.b, 0, 1))
end

"""
One opaque colour per contour band, as a categorical colormap so that each band gets
exactly its own colour. The middle band, `cld(n_bands, 2)` counting from the outside, is
`colour` itself; outer bands darken linearly to `outer_darkening` lower Lab lightness and
inner bands lighten linearly to `inner_lightening` higher.
"""
function band_colormap(colour, n_bands; outer_darkening, inner_lightening)
    middle = cld(n_bands, 2)
    lightness_shift(band) =
        band <= middle ? -outer_darkening * (middle - band) / max(middle - 1, 1) :
        inner_lightening * (band - middle) / (n_bands - middle)
    colours = [
        band == middle ? RGBf(colour) : shift_lightness(colour, lightness_shift(band))
        for band in 1:n_bands
    ]
    return cgrad(colours; categorical=true)
end

"""
Filled contours of each component, from `outer_level` times its peak density inwards.
"""
function draw_posterior!(
    ax,
    components,
    colours,
    xs,
    ys;
    n_levels=10,
    outer_level=0.3,
    outer_darkening=15,
    inner_lightening=12,
)
    for (component, colour) in zip(components, colours)
        density = [pdf(component, [x, y]) for x in xs, y in ys]
        peak = maximum(density)
        contourf!(
            ax,
            xs,
            ys,
            density;
            levels=range(outer_level * peak, peak; length=n_levels + 1),
            colormap=band_colormap(colour, n_levels; outer_darkening, inner_lightening),
        )
    end
    return ax
end

function make_logo(;
    output=joinpath(@__DIR__, "logo.mp4"),
    seed=2,
    min_loop_seconds=20,
    loop_tolerance=0.03,
    closing_attempts=200,
    step_size=0.03,
    substeps=4,
    steps_per_frame=3,
    corner_steps=6,
    tail_length=40,
    max_linewidth=6,
    tail_alpha=0.5,
    twinkle_lifetime_seconds=0.8,
    twinkle_size=22,
    twinkle_whiteness=0.7,
    twinkle_turn=π / 4,
    twinkle_glow_scale=2.2,
    twinkle_glow_alpha=0.35,
    outer_level=0.3,
    background=colorant"#292a2d",
    fps=60,
    figsize=(600, 600),
    preview_seconds=nothing,
)
    rng = Xoshiro(seed)
    components = julia_logo_components()
    steps_per_second = fps * steps_per_frame
    seconds_to_steps(seconds) = round(Int, seconds * steps_per_second)
    min_steps = seconds_to_steps(min_loop_seconds) ÷ substeps
    chains, speeds = synchronised_chains(
        rng,
        components,
        mean.(components),
        step_size;
        loop_multiple=steps_per_frame,
        substeps,
        corner_steps,
        min_steps,
        max_steps=3min_steps,
        tolerance=loop_tolerance,
        closing_attempts,
    )

    lims = 2.0
    xs = range(-lims, lims; length=300)
    ys = range(-lims, lims; length=300)

    fig = Figure(; size=figsize, backgroundcolor=background)
    ax = Axis(
        fig[1, 1];
        aspect=DataAspect(),
        limits=(-lims, lims, -lims, lims),
        backgroundcolor=background,
    )
    hidedecorations!(ax)
    hidespines!(ax)
    component_colours = (JULIA_COLOURS.green, JULIA_COLOURS.purple, JULIA_COLOURS.red)
    draw_posterior!(ax, components, component_colours, xs, ys; outer_level)

    styles = (;
        comet_style=(;
            tail_length=tail_length * substeps,
            max_linewidth,
            max_alpha=tail_alpha,
        ),
        twinkle_style=(;
            lifetime=seconds_to_steps(twinkle_lifetime_seconds),
            max_size=twinkle_size,
            max_whiteness=twinkle_whiteness,
            max_turn=twinkle_turn,
            glow_scale=twinkle_glow_scale,
            glow_alpha=twinkle_glow_alpha,
        ),
    )
    move_chains_to! = [
        draw_chain!(ax, chain, colour; styles...) for
        (chain, colour) in zip(chains, component_colours)
    ]

    heads = 1:steps_per_frame:length(first(chains))
    loop_seconds = length(heads) / fps
    if !isnothing(preview_seconds)
        heads = heads[1:min(end, round(Int, preview_seconds*fps))]
    end
    record(fig, output, heads; framerate=fps) do head
        foreach(move_to! -> move_to!(head), move_chains_to!)
    end
    return (; output, loop_seconds, speeds)
end
