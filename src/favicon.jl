# Generates the site icons: the three Julia dots on a Normal-density curve.
#
# - `favicon.svg`: the tab icon.
# - `favicon.ico`: a 32px fallback for browsers without SVG favicons.
# - `apple-touch-icon.png`: the 180px home-screen icon. iOS fetches it from the
#   site root.
#
# Run from the repository root: `julia src/favicon.jl`. It needs `rsvg-convert`
# (Homebrew: `brew install librsvg`).

# Colours the curve with the OKLCH gradient of the hero curve.
include("hero_curve.jl")

const ICON_SIZE = 32
# Space between the drawing and the edge of the view box.
const ICON_MARGIN = 1.5
# In julia-dots.svg from JuliaLang/julia-logo-graphics, the dot centres form an
# equilateral triangle with side 173.205 and the dots have radius 75.
const JULIA_DOT_SPACING = 173.205 / 75
# The logo's colours, from left to right: red at bottom left, green at the top
# and purple at bottom right. The curve runs through them in the same order.
const DOT_COLORS = ("#CB3C33", "#389826", "#9558B2")
# The remaining lengths are in units of the dot radius. The script then scales
# the drawing to fill the icon.
# The dots keep the logo's triangle, 1.3 times as wide, so that the curve shows
# between them.
const DOT_SPREAD = 1.3
const CURVE_STROKE = 0.6
# The curve stops this far short of each dot, so the dots read as separate.
const DOT_GAP = 0.19
# How far the curve base sits below the centres of the side dots.
const TAIL_DROP = 1.3
# How far the tails run past the centres of the side dots.
const TAIL_LENGTH = 2.0
const TOUCH_ICON_PX = 180
const TOUCH_ICON_BACKGROUND = "#FFFFFF"
# Apple's icon grid keeps the artwork inside about 80% of the icon.
const TOUCH_ICON_SCALE = 0.8

"""
    icon_svg(; id="favicon", background=nothing, scale=1.0)

Return the icon as SVG markup in a $(ICON_SIZE)×$(ICON_SIZE) view box.
"""
function icon_svg(; id="favicon", background=nothing, scale=1.0)
    # Lay out the mark with dot radius 1, the top dot at the origin and y down.
    side = JULIA_DOT_SPACING * DOT_SPREAD
    half_side, drop = side / 2, side * sqrt(3) / 2
    base = drop + TAIL_DROP
    # The curve peaks at the top dot. σ puts the side dots on it too.
    σ = half_side / sqrt(-2log(1 - drop / base))
    tail_end = half_side + TAIL_LENGTH
    width = max(2tail_end + CURVE_STROKE, side + 2)
    top, bottom = -1.0, max(base + CURVE_STROKE / 2, drop + 1)
    # Scale and centre the mark in the icon.
    k = (ICON_SIZE - 2ICON_MARGIN) / max(width, bottom - top)
    centre = ICON_SIZE / 2
    to_x(x) = round(centre + k * x; digits=2)
    to_y(y) = round(centre + k * (y - (top + bottom) / 2); digits=2)
    curve_y(x) = base - normal_height(x, σ, base)
    dots = [(to_x(x), to_y(y)) for (x, y) in ((-half_side, drop), (0.0, 0.0), (half_side, drop))]
    points = join(("$(to_x(x)),$(to_y(curve_y(x)))" for x in range(-tail_end, tail_end; length=121)), " L")
    x_lo, x_hi = to_x(-tail_end), to_x(tail_end)
    dot_offsets = round.((first.(dots) .- x_lo) ./ (x_hi - x_lo); digits=4)
    radius, stroke = round(k; digits=2), round(k * CURVE_STROKE; digits=2)
    stops = join(
        (
            """<stop offset="$offset" stop-color="$color"/>""" for
            (offset, color) in gradient_stops(dot_offsets; colors=DOT_COLORS)
        ),
    )
    holes = join(
        (
            """<circle cx="$(round(x; digits=2))" cy="$(round(y; digits=2))" r="$(round(k * (1 + DOT_GAP); digits=2))"/>"""
            for (x, y) in dots
        ),
    )
    circles = join(
        (
            """<circle cx="$(round(x; digits=2))" cy="$(round(y; digits=2))" r="$radius" fill="$color"/>"""
            for ((x, y), color) in zip(dots, DOT_COLORS)
        ),
    )
    backdrop = isnothing(background) ? "" : """<rect width="$ICON_SIZE" height="$ICON_SIZE" fill="$background"/>"""
    offset = round((1 - scale) * centre; digits=2)
    return """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $ICON_SIZE $ICON_SIZE">\
    <defs>\
    <linearGradient id="$id-curve" gradientUnits="userSpaceOnUse" x1="$x_lo" x2="$x_hi" y1="0" y2="0">$stops</linearGradient>\
    <mask id="$id-gaps"><rect width="$ICON_SIZE" height="$ICON_SIZE" fill="#fff"/><g fill="#000">$holes</g></mask>\
    </defs>\
    $backdrop\
    <g transform="translate($offset $offset) scale($scale)">\
    <path d="M$points" fill="none" stroke="url(#$id-curve)" stroke-width="$stroke" stroke-linecap="round" mask="url(#$id-gaps)"/>\
    $circles\
    </g>\
    </svg>
    """
end

function rasterize(svg, px)
    return read(pipeline(IOBuffer(svg), `rsvg-convert --width=$px --height=$px --format=png`))
end

# An ICO file can hold a PNG image as is. Its 22-byte header describes one image.
function write_ico(path, png, px)
    open(path, "w") do io
        write(io, UInt16[0, 1, 1])
        write(io, UInt8[px % 256, px % 256, 0, 0])
        write(io, UInt16[1, 32])
        write(io, UInt32[length(png), 22])
        write(io, png)
    end
    return path
end

function write_icons(root=dirname(@__DIR__))
    svg = icon_svg()
    write(joinpath(root, "favicon.svg"), svg)
    write_ico(joinpath(root, "favicon.ico"), rasterize(svg, ICON_SIZE), ICON_SIZE)
    touch_svg = icon_svg(; background=TOUCH_ICON_BACKGROUND, scale=TOUCH_ICON_SCALE)
    write(joinpath(root, "apple-touch-icon.png"), rasterize(touch_svg, TOUCH_ICON_PX))
    return root
end

if abspath(PROGRAM_FILE) == @__FILE__
    write_icons()
end
