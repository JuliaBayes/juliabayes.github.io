# 100% vibe coded woopsies

# Generates `_hero-curve.md`: the Normal-density curve drawn behind the landing
# page title. Distances are in CSS px and measured from the curve base, which
# sits at the bottom of the title.
#
# Run from the repository root: `julia src/hero_curve.jl`.

# Quarto sets the root font size to 17px in both themes.
const REM_PX = 17
const TITLE_LINE_HEIGHT = 1.1
const TITLE_GLYPHS = length("JuliaBayes")
# Average glyph advance of "JuliaBayes" in IBM Plex Sans Bold, as a fraction of
# the font size. Measured in the browser as 0.513.
const AVERAGE_ADVANCE_EM = 0.52
const CLEARANCE_PX = 12
const TAIL_TOLERANCE_PX = 8
const CURVE_STROKE_PX = 6

# Font sizes must match the hero rules in theming/rules/_hero.scss. The phone layout applies
# below Bootstrap's sm breakpoint (576px); its row is the card row at that width.
const HERO_LAYOUTS = (
    desktop=(;
        title_font_px=4 * REM_PX,
        row_half_width_px=400,
        curve_width_px=800,
        gradient_inset=0.0,
    ),
    phone=(;
        title_font_px=2.5 * REM_PX,
        row_half_width_px=272,
        curve_width_px=544,
        gradient_inset=0.15,
    ),
)

# Julia green, purple and red. SVG interpolates gradient stops in sRGB, which
# passes through grey between green and purple. Extra stops interpolated in
# OKLCH keep the lightness and chroma changes even along the curve.
const GRADIENT_COLORS = ("#389826", "#9558B2", "#CB3C33")
const GRADIENT_STOPS_PER_SEGMENT = 8

srgb_to_linear(c) = c ≤ 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055)^2.4
linear_to_srgb(c) = c ≤ 0.0031308 ? 12.92c : 1.055c^(1 / 2.4) - 0.055

# Matrices from Björn Ottosson, "A perceptual color space for image processing"
# (2020).
function hex_to_oklch(hex)
    r, g, b = (srgb_to_linear(parse(Int, hex[i:(i + 1)]; base=16) / 255) for i in (2, 4, 6))
    l, m, s = cbrt.((
        0.4122214708r + 0.5363325363g + 0.0514459929b,
        0.2119034982r + 0.6806995451g + 0.1073969566b,
        0.0883024619r + 0.2817188376g + 0.6299787005b,
    ))
    L = 0.2104542553l + 0.7936177850m - 0.0040720468s
    a = 1.9779984951l - 2.4285922050m + 0.4505937099s
    b = 0.0259040371l + 0.7827717662m - 0.8086757660s
    return (; L, C=hypot(a, b), h=atan(b, a))
end

function oklch_to_hex((; L, C, h))
    a, b = C * cos(h), C * sin(h)
    l, m, s = (
        L + 0.3963377774a + 0.2158037573b,
        L - 0.1055613458a - 0.0638541728b,
        L - 0.0894841775a - 1.2914855480b,
    ) .^ 3
    rgb = (
        4.0767416621l - 3.3077115913m + 0.2309699292s,
        -1.2684380046l + 2.6097574011m - 0.3413193965s,
        -0.0041960863l - 0.7034186147m + 1.7076147010s,
    )
    channels = (round(Int, 255 * linear_to_srgb(clamp(c, 0, 1))) for c in rgb)
    return "#" * uppercase(join(string(c; base=16, pad=2) for c in channels))
end

# The hue takes the shorter way round the colour wheel.
function interpolate_oklch(from, to, t)
    Δh = rem2pi(to.h - from.h, RoundNearest)
    return (; L=from.L + t * (to.L - from.L), C=from.C + t * (to.C - from.C), h=from.h + t * Δh)
end

"""
    gradient_stops(offsets; colors=GRADIENT_COLORS)

Return `(offset, hex)` pairs that run through `colors`, placed at `offsets`,
with `GRADIENT_STOPS_PER_SEGMENT` stops in each segment.
"""
function gradient_stops(offsets; colors=GRADIENT_COLORS)
    oklch = map(hex_to_oklch, colors)
    n = GRADIENT_STOPS_PER_SEGMENT
    stops = [(first(offsets), first(colors))]
    for i in 1:(length(colors) - 1), k in 1:n
        t = k / n
        offset = offsets[i] + t * (offsets[i + 1] - offsets[i])
        color = k == n ? colors[i + 1] : oklch_to_hex(interpolate_oklch(oklch[i], oklch[i + 1], t))
        push!(stops, (round(offset; digits=4), color))
    end
    return stops
end

normal_height(x, σ, peak_height) = peak_height * exp(-x^2 / (2σ^2))

function sigma_lower_bound(peak_height, half_width, top)
    peak_height > top || return Inf
    return half_width / sqrt(2log(peak_height / top))
end

function sigma_upper_bound(peak_height, row_half_width, tail_tolerance)
    peak_height > tail_tolerance || return Inf
    return row_half_width / sqrt(2log(peak_height / tail_tolerance))
end

"""
    solve_curve(; text_boxes, row_half_width, clearance, tail_tolerance, max_peak_height=1000)

Return `(; σ, peak_height)` for the lowest integer `peak_height` at which a Normal
curve clears every `(half_width, top)` box by `clearance` while staying within
`tail_tolerance` of the base at `row_half_width`. `σ` is the smallest feasible
value, rounded up to 0.1px.
"""
function solve_curve(;
    text_boxes,
    row_half_width,
    clearance,
    tail_tolerance,
    max_peak_height=1000,
)
    for peak_height in 1:max_peak_height
        σ_min = maximum(
            sigma_lower_bound(peak_height, half_width + clearance, top + clearance) for
            (half_width, top) in text_boxes
        )
        σ = ceil(σ_min; digits=1)
        isfinite(σ) &&
            σ ≤ sigma_upper_bound(peak_height, row_half_width, tail_tolerance) &&
            return (; σ, peak_height)
    end
    binding_box = argmax(
        ((half_width, top),) ->
            sigma_lower_bound(max_peak_height, half_width + clearance, top + clearance),
        text_boxes,
    )
    throw(
        ArgumentError(
            "no peak height ≤ $max_peak_height px clears text box $binding_box " *
            "(half width, top) with clearance $clearance px while the curve stays within " *
            "$tail_tolerance px of the base at ±$row_half_width px",
        ),
    )
end

"""
    curve_svg(; σ, peak_height, width, gradient_id, gradient_inset=0.0, step=4, stroke_width=2)

`gradient_inset` moves the green and red stops inward from the SVG's edges, as a
fraction of its width, so they stay visible when the edges are clipped.
"""
function curve_svg(;
    σ,
    peak_height,
    width,
    gradient_id,
    gradient_inset=0.0,
    step=4,
    stroke_width=2,
)
    base_y = peak_height + stroke_width
    height = base_y + stroke_width
    centre = width / 2
    points = join(
        (
            "$x,$(round(base_y - normal_height(x - centre, σ, peak_height); digits=1))"
            for x in 0:step:width
        ),
        " L",
    )
    stops = join(
        (
            """<stop offset="$offset" stop-color="$color"/>""" for
            (offset, color) in gradient_stops((gradient_inset, 0.5, 1 - gradient_inset))
        ),
        "\n      ",
    )
    return """
    <svg width="$width" height="$height" viewBox="0 0 $width $height" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="$gradient_id" x1="0" x2="1" y1="0" y2="0">
          $stops
        </linearGradient>
      </defs>
      <path d="M$points" fill="none" stroke="url(#$gradient_id)" stroke-width="$stroke_width" stroke-linejoin="round"/>
    </svg>"""
end

function write_hero_curve(path, svgs_by_layout)
    wrappers = join(
        (
            """<div class="hero-curve hero-curve-$layout">\n$svg\n</div>""" for
            (layout, svg) in pairs(svgs_by_layout)
        ),
        "\n",
    )
    write(
        path,
        """
        ```{=html}
        <!-- Generated by src/hero_curve.jl -->
        $wrappers
        ```
        """,
    )
    return path
end

function hero_text_boxes(; title_font_px)
    half_width = TITLE_GLYPHS * AVERAGE_ADVANCE_EM * title_font_px / 2
    return [(half_width, title_font_px * TITLE_LINE_HEIGHT)]
end

function solve_hero_curves()
    return map(HERO_LAYOUTS) do layout
        solve_curve(;
            text_boxes=hero_text_boxes(; layout.title_font_px),
            row_half_width=layout.row_half_width_px,
            clearance=CLEARANCE_PX,
            tail_tolerance=TAIL_TOLERANCE_PX,
        )
    end
end

function main(path=joinpath(dirname(@__DIR__), "_hero-curve.md"))
    curves = solve_hero_curves()
    layouts = keys(HERO_LAYOUTS)
    svgs_by_layout = NamedTuple{layouts}(
        map(layouts) do layout
            (; σ, peak_height) = curves[layout]
            curve_svg(;
                σ,
                peak_height,
                width=HERO_LAYOUTS[layout].curve_width_px,
                gradient_inset=HERO_LAYOUTS[layout].gradient_inset,
                gradient_id="hero-curve-gradient-$layout",
                stroke_width=CURVE_STROKE_PX,
            )
        end,
    )
    write_hero_curve(path, svgs_by_layout)
    return curves
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
