# Generates the site icons: the three Julia dots on a Normal-density curve.
#
# - `favicon.svg`: the tab icon.
# - `favicon.ico`: a 32px fallback for browsers without SVG favicons.
# - `rss-icon.png`: the same 32px icon for feed readers.
# - `apple-touch-icon.png`: the 180px home-screen icon. iOS fetches it from the
#   site root.
#
# Run from the repository root: `julia src/favicon.jl`. It needs `rsvg-convert`
# (Homebrew: `brew install librsvg`).

# Colours the curve with the OKLCH gradient of the hero curve.
include("hero_curve.jl")

const ICON_SIZE = 32
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

"""
    icon_svg(; id="favicon", background=nothing, square=false)

Return the icon cropped to its painted bounds. Keep a square canvas for
raster icons.
"""
function icon_svg(; id="favicon", background=nothing, square=false)
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
    k = ICON_SIZE / max(width, bottom - top)
    centre = ICON_SIZE / 2
    to_x(x) = round(centre + k * x; digits=2)
    to_y(y) = round(centre + k * (y - (top + bottom) / 2); digits=2)
    curve_y(x) = base - normal_height(x, σ, base)
    dots = [(to_x(x), to_y(y)) for (x, y) in ((-half_side, drop), (0.0, 0.0), (half_side, drop))]
    points = join(("$(to_x(x)),$(to_y(curve_y(x)))" for x in range(-tail_end, tail_end; length=121)), " L")
    x_lo, x_hi = to_x(-tail_end), to_x(tail_end)
    dot_offsets = round.((first.(dots) .- x_lo) ./ (x_hi - x_lo); digits=4)
    radius = round(k; digits=2)
    # Rounding the tail centres can leave slightly less room for the caps.
    stroke = round(min(k * CURVE_STROKE, 2x_lo, 2(ICON_SIZE - x_hi)); digits=2)
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
    view_box = if square
        "0 0 $ICON_SIZE $ICON_SIZE"
    else
        # Use the rounded drawing coordinates so neither a dot nor a round
        # stroke cap gets clipped by the crop.
        left_dot, right_dot = extrema(first.(dots))
        top_dot, bottom_dot = extrema(last.(dots))
        left = min(left_dot - radius, x_lo - stroke / 2)
        right = max(right_dot + radius, x_hi + stroke / 2)
        upper = min(top_dot - radius, to_y(0) - stroke / 2)
        lower = max(bottom_dot + radius, to_y(curve_y(tail_end)) + stroke / 2)
        join(round.((left, upper, right - left, lower - upper); digits=3), ' ')
    end
    return """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="$view_box">\
    <defs>\
    <linearGradient id="$id-curve" gradientUnits="userSpaceOnUse" x1="$x_lo" x2="$x_hi" y1="0" y2="0">$stops</linearGradient>\
    <mask id="$id-gaps"><rect width="$ICON_SIZE" height="$ICON_SIZE" fill="#fff"/><g fill="#000">$holes</g></mask>\
    </defs>\
    $backdrop\
    <path d="M$points" fill="none" stroke="url(#$id-curve)" stroke-width="$stroke" stroke-linecap="round" mask="url(#$id-gaps)"/>\
    $circles\
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
    png = rasterize(icon_svg(; square=true), ICON_SIZE)
    write_ico(joinpath(root, "favicon.ico"), png, ICON_SIZE)
    write(joinpath(root, "rss-icon.png"), png)
    touch_svg = icon_svg(; background=TOUCH_ICON_BACKGROUND, square=true)
    write(joinpath(root, "apple-touch-icon.png"), rasterize(touch_svg, TOUCH_ICON_PX))
    return root
end

if abspath(PROGRAM_FILE) == @__FILE__
    write_icons()
end
