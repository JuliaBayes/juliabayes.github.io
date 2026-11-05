using Test

include(joinpath(@__DIR__, "hero_curve.jl"))

@testset "hero curve" begin
    @test normal_height(0, 100, 200) == 200
    @test normal_height(100, 100, 200) ≈ 200 * exp(-0.5)

    boxes = [(176, 106.4), (200.2, 28)]
    (; σ, peak_height) =
        solve_curve(; text_boxes=boxes, row_half_width=400, clearance=12, tail_tolerance=8)
    for (half_width, top) in boxes
        @test normal_height(half_width + 12, σ, peak_height) ≥ top + 12
    end
    @test normal_height(400, σ, peak_height) ≤ 8
    @test_throws "no peak height" solve_curve(;
        text_boxes=[(390, 100)],
        row_half_width=400,
        clearance=12,
        tail_tolerance=8,
    )

    svg = curve_svg(; σ, peak_height, width=800, gradient_id="test-gradient")
    @test occursin("aria-hidden=\"true\"", svg)
    @test occursin("id=\"test-gradient\"", svg)
    @test occursin("stroke=\"url(#test-gradient)\"", svg)
    @test all(colour -> occursin(colour, svg), ("#389826", "#9558B2", "#CB3C33"))
    @test occursin("width=\"800\"", svg)
    @test occursin("offset=\"0.0\" stop-color=\"#389826\"", svg)

    inset_svg = curve_svg(;
        σ,
        peak_height,
        width=800,
        gradient_id="test-gradient",
        gradient_inset=0.15,
    )
    @test occursin("offset=\"0.15\" stop-color=\"#389826\"", inset_svg)
    @test occursin("offset=\"0.5\" stop-color=\"#9558B2\"", inset_svg)
    @test occursin("offset=\"0.85\" stop-color=\"#CB3C33\"", inset_svg)

    desktop_boxes = hero_text_boxes(; title_font_px=64, subtitle_font_px=28)
    @test collect(Iterators.flatten(desktop_boxes)) ≈ [176, 106.4, 200.2, 28]

    snippet_path = tempname()
    main(snippet_path)
    snippet = read(snippet_path, String)
    @test occursin("class=\"hero-curve hero-curve-desktop\"", snippet)
    @test occursin("class=\"hero-curve hero-curve-phone\"", snippet)
    @test occursin("id=\"hero-curve-gradient-desktop\"", snippet)
    @test occursin("id=\"hero-curve-gradient-phone\"", snippet)
end

@testset "phone curve is lower than desktop curve" begin
    (; desktop, phone) = solve_hero_curves()
    @test phone.peak_height < desktop.peak_height
end
