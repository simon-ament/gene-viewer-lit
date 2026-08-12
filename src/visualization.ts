import * as d3 from "d3";
import type { Region, Probe, Gene, Feature, Sequence, ProbeSelection, ProbeSetData } from "./types.js";
import {
    calculateArrowSpacing,
    centeredMinWidthRect,
    collectProbeBases,
    collectProbeComponents,
    collectReferenceBases,
    exportSVG,
    featureTooltipHTML,
    probeTooltipHTML,
    regionTooltipHTML,
    transcriptTooltipHTML,
    type Base,
    type ProbePosition,
} from "./helpers.js";
import { RegionMap } from "./constants.js";
import { drawHeader, drawFooter } from "./visualization/legend.js";
import { updateLocationIndicator } from "./visualization/location-indicator.js";

export type VisualizationContext = {
    svg: d3.Selection<SVGElement, unknown, null, unknown>;
    plot: d3.Selection<SVGGElement, unknown, null, unknown>;
    probesGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    tracksGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    regionsGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    baseGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    locationIndicator: d3.Selection<SVGRectElement, unknown, null, unknown>;
    locationIndicatorPosition: number;
    positionLabelGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    headerGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    footerGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    tooltip: d3.Selection<HTMLDivElement, unknown, null, unknown>;
    xScale: d3.ScaleLinear<number, number>;
    xAxis: d3.Selection<SVGGElement, unknown, null, unknown>;
    zoomBehavior: d3.ZoomBehavior<SVGGElement, unknown>;
    currentZoomTransform: d3.ZoomTransform;
    height: number;
    parallelProbesets: number;
    softenedScaleFactor: number;
    scaledWidth: number;
    svgWidth: number;
    svgHeight: number;
};

const WIDTH = 800;
const PROBE_HEIGHT = 20;
const TRANSCRIPT_HEIGHT = 20;
const TRANSCRIPT_MARKER_WIDTH = 8;
const TRACK_HEIGHT = 15;
const GAP = 50;
const AXIS_HEIGHT = 20;
const MIN_PROBE_WIDTH = 2;
export const PADDING_LEFT = 70;
const PADDING_RIGHT = 0;
export const PADDING_TOP = 70;
const PADDING_BOTTOM = 50;

/**
 * Creates the D3 visualization context by creating the necessary SVG elements and groups.
 *
 * @param el The container element for the visualization.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const createContext = (
    el: HTMLElement,
    gene: Gene,
    parallelProbesets: number,
    scaleFactor: number
): VisualizationContext => {
    const svg = d3.select(el).select("svg") as d3.Selection<SVGElement, unknown, null, unknown>;
    svg.append("rect")
        .attr("id", "svg-background")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "var(--background-color)");
    const height =
        Object.keys(gene.regions).length * TRANSCRIPT_HEIGHT +
        parallelProbesets * PROBE_HEIGHT +
        GAP +
        AXIS_HEIGHT;
    const scaledWidth = WIDTH / scaleFactor;
    const svgWidth = scaledWidth + PADDING_LEFT + PADDING_RIGHT;
    const svgHeight = height + PADDING_TOP + PADDING_BOTTOM;
    const softenedScaleFactor = 1 + (scaleFactor - 1) * 0.5;

    const plot = svg.append("g");
    plot.append("rect")
        .attr("id", "plot-background")
        .attr("width", scaledWidth)
        .attr("height", height)
        .attr("fill", "var(--background-color)")
    const locationIndicator = plot.append("rect").attr("id", "location-indicator");
    const probesGroup = plot.append("g").attr("class", "probes");
    const tracksGroup = plot.append("g").attr("class", "tracks");
    const regionsGroup = plot.append("g").attr("class", "genomic-regions");
    const baseGroup = plot.append("g").attr("class", "reference-bases");
    const headerGroup = svg.append("g").attr("class", "header");
    const footerGroup = svg.append("g").attr("class", "footer");
    const tooltip = d3.select(el).append("div").attr("id", "region-tooltip");

    const zoomBehavior = d3.zoom() as d3.ZoomBehavior<SVGGElement, unknown>;
    const xScale = d3.scaleLinear();
    const xAxis = svg.append("g");
    const positionLabelGroup = plot
        .append("g")
        .attr("id", "position-label-group");
    positionLabelGroup.append("rect");
    positionLabelGroup.append("text");

    return {
        svg,
        plot,
        probesGroup,
        tracksGroup,
        regionsGroup,
        baseGroup,
        locationIndicator,
        locationIndicatorPosition: 0,
        positionLabelGroup,
        headerGroup,
        footerGroup,
        tooltip,
        xScale,
        xAxis,
        zoomBehavior,
        currentZoomTransform: d3.zoomIdentity,
        height,
        parallelProbesets,
        softenedScaleFactor,
        scaledWidth,
        svgWidth,
        svgHeight,
    };
};

/**
 * Sets up the x scale and axis based on the extent of probe positions and genomic regions.
 *
 * @param context The visualization context object.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const setupScalesAndAxes = (
    context: VisualizationContext,
    gene: Gene
) => {
    // Define x scale based on combined extent of probes and genomic regions
    const ext = d3.extent([
        ...Object.values(gene.probes).flat().flatMap((d: Probe) => [d.start, d.end]),
        ...Object.values(gene.regions).flat().flatMap((d: Region) => [d.start, d.end]),
        ...Object.values(gene.sequences).flat().flatMap((d: Sequence) => [d.start, d.start + d.sequence.length - 1]),
        ...Object.values(gene.tracks).flat().flatMap((d: Feature) => [d.start, d.end]),
    ]) as [number, number];
    const extentPadding = (ext[1] - ext[0]) * 0.01; // add 1% padding on each side
    context.xScale
        .domain([ext[0] - extentPadding, ext[1] + extentPadding])
        .range([0.5, context.scaledWidth - 0.5]);
    const axis = d3.axisBottom(context.xScale).ticks(8 / context.softenedScaleFactor);

    // Append the x-axis in the outer SVG padding so it is not clipped by the plot
    context.xAxis
        .attr("class", "x-axis select-none")
        .attr(
            "transform",
            `translate(${PADDING_LEFT}, ${PADDING_TOP + context.height - AXIS_HEIGHT})`
        )
        .style("font-family", "inherit")
        .call(axis)
        .attr("clip-path", "url(#plot-clip)");
};

/**
 * Configures the initial state of all SVG elements in the visualization.
 *
 * @param context The visualization context object.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const setupElements = (
    context: VisualizationContext,
    gene: Gene,
) => {
    context.svg
        .attr("viewBox", [0, 0, context.svgWidth, context.svgHeight])
        .attr("width", context.svgWidth)
        .attr("height", context.svgHeight)
        .style("width", "100%")
        .style("height", "auto")
        .style("font-family", "inherit");

    context.plot
        .attr("transform", `translate(${PADDING_LEFT}, ${PADDING_TOP})`)
        .attr("clip-path", "url(#plot-clip)")
        .append("clipPath")
        .attr("id", "plot-clip")
        .append("rect")
        .attr("width", context.scaledWidth)
        .attr("height", context.height);

    // Location indicator as vertical bar following the mouse
    context.locationIndicator
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", context.xScale(1) - context.xScale(0))
        .attr("height", context.height - AXIS_HEIGHT)
        .attr("fill", "contrast-color(var(--background-color))")
        .attr("opacity", 0)
        .attr("visibility", "hidden")
        .attr("pointer-events", "none"); // allow mouse events to pass through

    // Position label text (number)
    context.positionLabelGroup
        .select("text")
        .attr("id", "position-label")
        .attr("class", "select-none")
        .attr("y", context.parallelProbesets * PROBE_HEIGHT + GAP / 2 + 5) // position within the gap between probes and transcripts
        .attr("text-anchor", "start")
        .attr("font-size", 9)
        .attr("fill", "var(--text-color)");

    // Position label background
    context.positionLabelGroup
        .select("rect")
        .attr("fill", "var(--background-color)")
        .attr("opacity", 1)
        .attr("pointer-events", "none");

    // Initially hide position label until mouse enters
    context.positionLabelGroup
        .attr("opacity", 0)
        .attr("visibility", "hidden")
        .attr("pointer-events", "none");

    // Tooltip div for probes, regions, and transcripts
    context.tooltip
        .style("opacity", 0)
        .style("background-color", "var(--background-color)")
        .style("border", "1px solid var(--border-color)")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0.5rem 1rem rgba(0, 0, 0, 0.1)")
        .style("padding", "5px")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "2000");

    // Draw genomic regions grouped by transcript
    Object.entries(gene.regions).forEach(([transcriptName, regions]) => {
        const yOffset =
            context.parallelProbesets * PROBE_HEIGHT +
            GAP +
            Object.keys(gene.regions).indexOf(transcriptName) * TRANSCRIPT_HEIGHT;

        const transcriptGroup = context.regionsGroup
            .append("g")
            .attr("class", "transcript")
            .attr("transform", `translate(0, ${yOffset})`);

        const regionsContainer = transcriptGroup
            .selectAll("g")
            .data(regions)
            .join("g")
            .attr("class", "genomic-region")
            .attr(
                "transform",
                (d: Region) =>
                    `translate(${context.xScale(d.start - 0.5)}, 0)`
            )
            .on("mouseover", function (_, d: Region) {
                context.tooltip
                    .html(regionTooltipHTML(d, transcriptName))    
                    .style("opacity", 1);
            })
            .on("mousemove mousemove-forwarded", (event) => {
                const xPos = event instanceof MouseEvent ? event.pageX : event.detail.pageX;
                const yPos = event instanceof MouseEvent ? event.pageY : event.detail.pageY;
                context.tooltip
                    .style(
                        "left",
                        xPos > window.innerWidth / 2
                            ? ""
                            : xPos + 20 + "px"
                    )
                    .style(
                        "right",
                        xPos > window.innerWidth / 2
                            ? window.innerWidth - xPos + 10 + "px"
                            : ""
                    )
                    .style("top", yPos + "px")
                    .style("bottom", ""); // reset bottom in case it was set before
            })
            .on("mouseleave", function () {
                context.tooltip.style("opacity", 0);
            });

        // Draw a rect for each region
        regionsContainer
            .append("rect")
            .attr("class", "region-rect")
            .attr(
                "width",
                (d: Region) =>
                    context.xScale(d.end + 0.5) - context.xScale(d.start - 0.5)
            )
            .attr("height", (d: Region) =>
                d.type === "intron"
                    ? TRANSCRIPT_HEIGHT / 10
                    : TRANSCRIPT_HEIGHT / 2
            )
            .attr("x", 0)
            .attr("y", function () {
                const height = d3.select(this).attr("height");
                return TRANSCRIPT_HEIGHT / 2 - Number(height) / 2;
            })
            .attr(
                "fill",
                (d: Region) =>
                    RegionMap[d.type || "unknown"].color || "lightgray"
            );

        // Padding container for intron hovering
        regionsContainer
            .append("rect")
            .attr("class", "region-hover-pad")
            .attr(
                "width",
                (d: Region) =>
                    context.xScale(d.end + 0.5) - context.xScale(d.start - 0.5)
            )
            .attr("height", TRANSCRIPT_HEIGHT / 2)
            .attr("x", 0)
            .attr("y", TRANSCRIPT_HEIGHT / 4)
            .attr("fill", "transparent");

        // Strand arrows
        regionsContainer.append("g").attr("class", "strand-arrows");

        // Marker for transcript match with probe
        if (transcriptName !== "unknown") {
            transcriptGroup
                .append("rect")
                .data([transcriptName])
                .attr("class", "transcript-marker")
                .attr("x", 0)
                .attr("y", TRANSCRIPT_HEIGHT * 0.05)
                .attr("width", TRANSCRIPT_MARKER_WIDTH)
                .attr("height", TRANSCRIPT_HEIGHT * 0.9)
                .attr("fill", "transparent")
                .on("mouseover", function (_, d: string) {
                    context.tooltip
                        .html(transcriptTooltipHTML(d, gene.probes))
                        .style("opacity", 1);
                })
                .on("mousemove mousemove-forwarded", (event) => {
                    const xPos = event instanceof MouseEvent ? event.pageX : event.detail.pageX;
                    const yPos = event instanceof MouseEvent ? event.pageY : event.detail.pageY;
                    context.tooltip
                        .style("left", xPos + 20 + "px")
                        .style("top", yPos + "px")
                        .style("bottom", ""); // reset bottom in case it was set before
                })
                .on("mouseleave", function () {
                    context.tooltip.style("opacity", 0);
                });
        }

        // Y-axis labels for transcripts
        context.svg.append("text")
            .attr("class", "y-axis-label select-none")
            .attr("x", PADDING_LEFT - 10)
            .attr("y", PADDING_TOP + yOffset + TRANSCRIPT_HEIGHT / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", 8)
            .attr("fill", "var(--text-color)")
            .text(transcriptName.slice(0, 10) + (transcriptName.length > 10 ? "..." : "")) // truncate long names
            .attr("title", transcriptName); // show full name on hover
    });

    // Draw custom tracks below the genomic regions
    Object.entries(gene.tracks).forEach(([trackName, features], index) => {
        const yOffset =
            context.parallelProbesets * PROBE_HEIGHT +
            GAP +
            Object.keys(gene.regions).length * TRANSCRIPT_HEIGHT +
            index * TRACK_HEIGHT;
        
        const trackGroup = context.tracksGroup
            .append("g")
            .attr("class", "track")
            .attr("transform", `translate(0, ${yOffset})`);

        trackGroup
            .selectAll("g")
            .data(features)
            .join("rect")
            .attr("class", "track-feature")
            .attr("x", (d: Feature) => context.xScale(d.start - 0.5))
            .attr("fill", (d: Feature) => d.item_rgb || "black")
            .attr("opacity", (d: Feature) => d.opacity ?? 1)
            .attr("width", (d: Feature) => context.xScale(d.end + 0.5) - context.xScale(d.start - 0.5))
            .on("mouseover", function (_, d: Feature) {
                context.tooltip
                    .html(featureTooltipHTML(d))
                    .style("opacity", 1);
            })
            .on("mousemove mousemove-forwarded", (event) => {
                const xPos = event instanceof MouseEvent ? event.pageX : event.detail.pageX;
                const yPos = event instanceof MouseEvent ? event.pageY : event.detail.pageY;
                context.tooltip
                    .style("left", xPos + 20 + "px")
                    .style("top", yPos + "px")
                    .style("bottom", ""); // reset bottom in case it was set before
            })
            .on("mouseleave", function () {
                context.tooltip.style("opacity", 0);
            });

        // Y-axis labels for tracks
        context.svg.append("text")
            .attr("class", "y-axis-label select-none")
            .attr("x", PADDING_LEFT - 10)
            .attr("y", PADDING_TOP + yOffset + TRACK_HEIGHT / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", 8)
            .attr("fill", "var(--text-color)")
            .text(trackName.slice(0, 10) + (trackName.length > 10 ? "..." : "")) // truncate long names
            .attr("title", trackName); // show full name on hover
    });

    drawHeader(context.headerGroup, gene);
    drawFooter(context.footerGroup, gene, { probesetId: null, probeIds: [] }, context);
};

/**
 * Sets up mouse events for the visualization, related to the location indicator and probe interactions.
 *
 * @param context The visualization context object.
 * @param setSelectedProbe A callback function to set the currently selected probe.
 * @param visualization The GeneViewerVisualization instance for handling probe selection and zooming.
 */
const setupMouseEvents = (
    context: VisualizationContext,
    setSelection: (selection: ProbeSelection) => void,
) => {
    const preventPageScroll: EventListener = (event) => {
        event.preventDefault();
    };
    context.plot
        .on("click", () => setSelection({ probesetId: null, probeIds: [] })) // deselect probes when clicking on empty space
        .on("wheel", preventPageScroll, { passive: false }) // some browsers default to passive wheel listeners
        .on("mouseenter", (event) => {
            context.locationIndicator.attr("visibility", "visible");
            context.positionLabelGroup.attr("visibility", "visible");
            const [xPos] = d3.pointer(event, context.plot.node());
            updateLocationIndicator(context, xPos);
        })
        .on("mousemove", (event) => {
            const [xPos] = d3.pointer(event, context.plot.node());
            updateLocationIndicator(context, xPos);
        })
        .on("mouseleave", () => {
            context.locationIndicator.attr("visibility", "hidden");
            context.locationIndicatorPosition = 0; // reset
            context.positionLabelGroup.attr("visibility", "hidden");
        });
};

/**
 * Sets up the zoom behavior for the visualization.
 *
 * @param context The visualization context object.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const setupZoom = (
    context: VisualizationContext,
    gene: Gene,
    selection: ProbeSelection,
    visibleProbesetIds: string[]
) => {
    const extent: [[number, number], [number, number]] = [
        [0, 0],
        [context.scaledWidth, context.height],
    ];

    context.zoomBehavior
        .scaleExtent([
            1,
            (context.xScale.domain()[1] - context.xScale.domain()[0]) / 100,
        ]) // max zoom to 100bp width
        .translateExtent(extent)
        .extent(extent)
        .on("zoom", (e) => zoomed(e, context, gene, selection, visibleProbesetIds));

    context.plot.call(context.zoomBehavior);
};

/**
 * Handles zoom events by rescaling and repositioning all elements in the visualization.
 *
 * @param event The D3 zoom event object containing the current transform.
 * @param context The visualization context object.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const zoomed = (
    event: d3.D3ZoomEvent<SVGGElement, unknown>,
    context: VisualizationContext,
    gene: Gene,
    selection: ProbeSelection,
    visibleProbesetIds: string[],
) => {
    context.currentZoomTransform = event.transform;
    const zx = event.transform.rescaleX(context.xScale);

    const plotNode = context.plot.node();
    if (event.sourceEvent instanceof MouseEvent && plotNode) {
        // use mouse position to update location indicator and tooltip
        const [xPos] = d3.pointer(event.sourceEvent, plotNode);
        updateLocationIndicator(context, xPos);

        if (event.sourceEvent.type === "mousemove") {
            // event gets captured by D3, so we dispatch a custom event instead
            const root = plotNode.getRootNode();

            if (root instanceof ShadowRoot) {
                const hoveredElement = root.elementFromPoint(event.sourceEvent.clientX, event.sourceEvent.clientY);
                const mouseMoveEvent = new CustomEvent("mousemove-forwarded", {
                    detail: {
                        pageX: event.sourceEvent.pageX,
                        pageY: event.sourceEvent.pageY,
                    },
                    bubbles: true,
                });
                hoveredElement?.dispatchEvent(mouseMoveEvent);
            }
        }
    } else {
        updateLocationIndicator(context); // use last known position
    }

    // Rescale location indicator
    context.locationIndicator.attr("width", zx(1) - zx(0));

    // Rescale probes
    context.probesGroup
        .selectAll("g.probeset-track")
        .selectAll("g.components")
        .selectAll<SVGRectElement, ProbePosition>("rect")
        .attr("x", (d) => zx(d.start - 0.5))
        .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

    context.probesGroup
        .selectAll("g.probeset-track")
        .selectAll("g.probes")
        .selectAll<SVGRectElement, Probe>("rect")
        .attr(
            "x",
            (d) =>
                centeredMinWidthRect(
                    zx(d.start - 0.5),
                    zx(d.end + 0.5),
                    MIN_PROBE_WIDTH
                ).x
        )
        .attr(
            "width",
            (d) =>
                centeredMinWidthRect(
                    zx(d.start - 0.5),
                    zx(d.end + 0.5),
                    MIN_PROBE_WIDTH
                ).width
        );

    // Rescale x axis
    const axis = d3.axisBottom(zx).ticks(8 / context.softenedScaleFactor);
    context.xAxis.call(axis);

    // Rescale genomic regions
    context.regionsGroup
        .selectAll<SVGGElement, Region>(".genomic-region")
        .attr("transform", (d) => `translate(${zx(d.start - 0.5)}, 0)`);
    context.regionsGroup
        .selectAll<SVGRectElement, Region>(".region-rect")
        .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));
    context.regionsGroup
        .selectAll<SVGRectElement, Region>(".region-hover-pad")
        .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

    // Rescale tracks
    context.tracksGroup
        .selectAll<SVGGElement, Feature>(".track-feature")
        .attr("x", (d) => zx(d.start - 0.5))
        .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

    // Calculate visible range
    const domain = zx.domain();
    const visibleRange = domain[1] - domain[0];
    const showBases = visibleRange <= 120 / context.softenedScaleFactor;
    const showArrows = visibleRange <= 3000 / context.softenedScaleFactor;

    // Show bases only when zoomed in and only if in view
    const bases = showBases
        ? collectReferenceBases(
            gene,
            Math.floor(domain[0]),
            Math.ceil(domain[1])
        )
        : [];
    context.baseGroup
        .selectAll<SVGTextElement, Base>("text")
        .data(bases)
        .join("text")
        .attr("class", "select-none")
        .attr("x", (d) => zx(d.position))
        .attr("y", context.parallelProbesets * PROBE_HEIGHT + GAP - 2)
        .attr("font-size", 10)
        .attr("fill", "var(--text-color)")
        .attr("text-anchor", "middle")
        .text((d) => d.char);

    // Show probe bases only when zoomed in and only if in view
    const probeBases = collectProbeBases(
        Object.entries(gene.probes)
            .filter(([probesetId]) => visibleProbesetIds.includes(probesetId))
            .map(([_, probes]) => probes)
            .flat()
            .filter((probe) => selection.probeIds.length > 0 ? selection.probeIds.includes(probe.id) : true),
        bases,
        Math.floor(domain[0]),
        Math.ceil(domain[1])
    );
    context.probesGroup
        .selectAll<SVGTextElement, Base>("text")
        .data(probeBases)
        .join("text")
        .attr("class", "select-none")
        .attr("x", (d) => zx(d.position))
        .attr("y", context.parallelProbesets * PROBE_HEIGHT + 15)
        .attr("font-size", 10)
        .attr("fill", "var(--text-color)")
        .attr("text-anchor", "middle")
        .text((d) => d.char);

    // Show bindings of the probes to transcripts when zoomed in
    context.regionsGroup
        .selectAll<SVGLineElement, ProbePosition>("line")
        .data(probeBases)
        .join("line")
        .attr("class", "binding")
        .attr("x1", (d) => zx(d.position))
        .attr("x2", (d) => zx(d.position))
        .attr("y1", context.parallelProbesets * PROBE_HEIGHT + 20)
        .attr("y2", context.parallelProbesets * PROBE_HEIGHT + GAP - 15)
        .attr("stroke", "#999")
        .attr("stroke-width", 1)
        .attr("pointer-events", "none"); // allow mouse events to pass through

    // Generate and render strand arrows
    if (showArrows) {
        const regions = context.regionsGroup.selectAll<SVGGElement, Region>(
            ".genomic-region"
        );
        // only keep visible regions
        const visible_regions = regions.filter(
            (d) =>
                d.end >= domain[0] &&
                d.start <= domain[1] &&
                d.strand !== undefined
        );
        visible_regions
            .selectAll<SVGGElement, Region>(".strand-arrows")
            .each(function (d) {
                const arrowGroup = d3.select(this);
                arrowGroup.selectAll("*").remove();

                const arrowPath = "M0,-3 L5,0 L0,3";
                const arrowPathInverted = "M5,-3 L0,0 L5,3";

                const arrowSpacing = calculateArrowSpacing(visibleRange);
                const startPos =
                    Math.ceil(d.start / arrowSpacing) * arrowSpacing - d.start;

                for (
                    let pos = startPos;
                    pos <= d.end - d.start;
                    pos += arrowSpacing
                ) {
                    const columnWidth = zx(1) - zx(0);
                    arrowGroup
                        .append("path")
                        .attr(
                            "d",
                            d.strand === "+" ? arrowPath : arrowPathInverted
                        )
                        .attr("stroke", "white")
                        .attr("fill", "transparent")
                        .attr(
                            "transform",
                            `translate(${pos * columnWidth}, ${TRANSCRIPT_HEIGHT / 2})`
                        );
                }
            });
    } else {
        // Clear arrows when zoomed out
        context.regionsGroup
            .selectAll<SVGGElement, Region>(".genomic-region")
            .selectAll<SVGGElement, Region>(".strand-arrows")
            .each(function () {
                d3.select(this).selectAll("*").remove();
            });
    }

    // Show location when bases are shown
    if (showBases) {
        context.locationIndicator.attr("opacity", 0.25);
        context.positionLabelGroup.attr("opacity", 1);
    } else {
        context.locationIndicator.attr("opacity", 0);
        context.positionLabelGroup.attr("opacity", 0);
    }
};

/**
 * Main object for the GeneViewer visualization, containing methods to create, update, and destroy the visualization.
 */
class GeneViewerVisualization {
    private gene: Gene;
    private visibleProbesetIds: string[];
    private selection: ProbeSelection;
    private setSelection: (selection: ProbeSelection) => void;
    private context: VisualizationContext;
    private parallelProbesets: number;

    /**
     * Creates a new GeneViewerVisualization instance and initializes the visualization.
     *
     * @param el The container element for the visualization.
     * @param gene The gene object containing probes and regions to be visualized.
     * @param visibleProbesets The list of probesets that should be visible in the visualization.
     * @param selection The current selection of probes and probeset.
     * @param setSelection A callback function to set the currently selected probes and probeset.
     * @param parallelProbesets The maximum number of probesets to display in parallel.
     * @param scaleFactor The scale factor for the visualization.
     */
    constructor(
        el: HTMLElement,
        gene: Gene,
        visibleProbesets: string[],
        selection: ProbeSelection,
        setSelection: (selection: ProbeSelection) => void,
        parallelProbesets: number,
        scaleFactor: number
    ) {
        this.gene = gene;
        this.visibleProbesetIds = visibleProbesets;
        this.selection = selection;
        this.setSelection = setSelection;
        this.parallelProbesets = Math.min(parallelProbesets, Object.keys(gene.probes).length);
        this.context = createContext(el, gene, this.parallelProbesets, scaleFactor);

        this._init();
    }

    /**
     * Orchestrates the initialization of the visualiazation.
     */
    private _init() {
        setupScalesAndAxes(this.context, this.gene);
        setupElements(this.context, this.gene);
        setupMouseEvents(this.context, this.setSelection);
        setupZoom(this.context, this.gene, this.selection, this.visibleProbesetIds);

        this.showProbesets(this.visibleProbesetIds);
        this.select(this.selection);
        
        zoomed(
            { transform: d3.zoomIdentity } as d3.D3ZoomEvent<SVGGElement, unknown>,
            this.context,
            this.gene,
            this.selection,
            this.visibleProbesetIds
        );
    }
    
    /**
     * Updates the list of visible probesets in the visualization.
     * 
     * @param visibleProbesets The list of probesets that should be visible in the visualization.
     */
    public showProbesets(visibleProbesets: string[]) {
        this.visibleProbesetIds = visibleProbesets.slice(0, this.parallelProbesets); // limit to the number of parallel probesets

        const probesets: ProbeSetData[] = [];
        for (const visibleProbesetId of this.visibleProbesetIds) {
            probesets.push({
                probesetId: visibleProbesetId,
                probes: this.gene.probes[visibleProbesetId]
            });
        }
        
        const probesetTracks = this.context.probesGroup
            .selectAll<SVGGElement, ProbeSetData>("g.probeset-track")
            .data(probesets, (d) => d.probesetId)
            .join("g")
            .attr("class", "probeset-track")
            .attr("transform", (_, i) => `translate(0, ${i * PROBE_HEIGHT})`)
        
        // horizontal probeset track line
        probesetTracks
            .selectAll("line.track-line")
            .data((d) => [d])
            .join("line")
            .attr("class", "track-line")
            .attr("x1", 0)
            .attr("x2", this.context.scaledWidth)
            .attr("y1", PROBE_HEIGHT / 2 - 0.5)
            .attr("y2", PROBE_HEIGHT / 2 - 0.5)
            .attr("stroke", (d) => (this.selection.probesetId === d.probesetId ? "orange" : "var(--border-color)"))
            .attr("stroke-width", 1)
            .attr("opacity", 0.5);

        // Draw probe components (probes and gaps)
        probesetTracks
            .selectAll("g.components")
            .data((d) => collectProbeComponents(d.probes))
            .join("g")
            .attr("class", "components")
            .selectAll<SVGRectElement, ProbePosition>("rect")
            .data((d) => [d])
            .join("rect")
            .attr("x", (d) => this.context.xScale(d.start - 0.5))
            .attr("y", 0)
            .attr(
                "width",
                (d) => this.context.xScale(d.end + 0.5) - this.context.xScale(d.start - 0.5)
            )
            .attr("height", PROBE_HEIGHT - 2)
            .attr("pointer-events", "none"); // allow mouse events to pass through to probe rects
        
        // Draw probe rectangles
        probesetTracks
            .selectAll("g.probes")
            .data((d) => d.probes)
            .join("g")
            .attr("class", "probes")
            .selectAll<SVGRectElement, Probe>("rect")
            .data((d) => [d])
            .join("rect")
            .attr("height", PROBE_HEIGHT - 2)
            .attr(
                "x",
                (d) =>
                    centeredMinWidthRect(
                        this.context.xScale(d.start - 0.5),
                        this.context.xScale(d.end + 0.5),
                        MIN_PROBE_WIDTH
                    ).x
            )
            .attr("y", 0)
            .attr(
                "width",
                (d) =>
                    centeredMinWidthRect(
                        this.context.xScale(d.start - 0.5),
                        this.context.xScale(d.end + 0.5),
                        MIN_PROBE_WIDTH
                    ).width
            )
            .attr("opacity", 0.5)
            .attr("cursor", "pointer")
            .on("click", (event, data) => {
                event.stopPropagation(); // prevent click from propagating to svg and deselecting probe
                this.select({ probesetId: null, probeIds: [data.id] }, true); // zoom into selected probe (even if already selected)
            })
            .on("mouseover", (_, d: Probe) => {
                this.context.tooltip
                    .html(probeTooltipHTML(d, this.gene.regions))    
                    .style("opacity", 1);
            })
            .on("mousemove mousemove-forwarded", (event) => {
                const xPos = event instanceof MouseEvent ? event.pageX : event.detail.pageX;
                const yPos = event instanceof MouseEvent ? event.pageY : event.detail.pageY;
                this.context.tooltip
                    .style(
                        "left",
                        xPos > window.innerWidth / 2
                            ? ""
                            : xPos + 20 + "px"
                    )
                    .style(
                        "right",
                        xPos > window.innerWidth / 2
                            ? window.innerWidth - xPos + 10 + "px"
                            : ""
                    )
                    .style("bottom", window.innerHeight - yPos + "px")
                    .style("top", ""); // reset top in case it was set before
            })
            .on("mouseleave", () => {
                this.context.tooltip.style("opacity", 0);
            });

        // Y-axis labels for probesets
        this.context.svg.selectAll<SVGTextElement, string>(".y-axis-label-probeset").remove(); // remove old labels
        this.context.svg.selectAll<SVGTextElement, string>(".y-axis-label-probeset")
            .data(this.visibleProbesetIds)
            .join("text")
            .attr("class", "y-axis-label-probeset select-none")
            .attr("x", PADDING_LEFT - 10)
            .attr("y", (_, i) => PADDING_TOP + i * PROBE_HEIGHT + PROBE_HEIGHT / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", 8)
            .attr("cursor", "pointer")
            .attr("fill", (d) => (this.selection.probesetId === d ? "orange" : "var(--text-color)"))
            .text((d) => d.slice(0, 10) + (d.length > 10 ? "..." : "")) // truncate long names
            .attr("title", (d) => d) // show full name on hover
            .on("click", (event, d) => {
                event.stopPropagation(); // prevent click from propagating to svg and deselecting probe
                // select all probes in the clicked probeset
                const probesInSet = this.gene.probes[d].map((probe) => probe.id);
                this.select({ probesetId: d, probeIds: probesInSet }, true); // zoom into selected probeset
            });

        // correctly color the probes according to the current selection
        this.select(this.selection);

        // update probes according to the current zoom transform
        zoomed(
            { transform: this.context.currentZoomTransform } as d3.D3ZoomEvent<SVGGElement, unknown>,
            this.context,
            this.gene,
            this.selection,
            this.visibleProbesetIds
        );
    }

    /**
     * Updates the currently selected probe in the visualization.
     * 
     * @param selection The selected probe and probeset.
     * @param zoomIntoProbes A boolean indicating whether to smoothly zoom into the selected probe. Defaults to false.
     */
    public select(selection: ProbeSelection, zoomIntoProbes: boolean = false) {
        this.selection = selection;

        const selectedProbes = Object.values(this.gene.probes)
            .flat()
            .filter((probe) => selection.probeIds.includes(probe.id));

        // Update probe colors based on selection
        this.context.probesGroup
            .selectAll("g.probeset-track")
            .selectAll("g.components")
            .selectAll<SVGRectElement, ProbePosition>("rect")
            .attr("fill", (d) =>
                selection.probeIds.includes(d.id) ? "orange" : "steelblue"
            )
            .filter((d) => selection.probeIds.includes(d.id))
            .raise();

        this.context.probesGroup
            .selectAll("g.probeset-track")
            .selectAll("g.probes")
            .selectAll<SVGRectElement, Probe>("rect")
            .attr("fill", (d) =>
                selection.probeIds.includes(d.id) ? "orange" : "steelblue"
            )
            .filter((d) => selection.probeIds.includes(d.id))
            .raise();

        this.context.probesGroup
            .selectAll("g.probeset-track")
            .selectAll<SVGLineElement, ProbeSetData>("line.track-line")
            .attr("stroke", (d) =>
                selection.probesetId === d.probesetId ? "orange" : "var(--border-color)"
            );

        this.context.svg
            .selectAll<SVGTextElement, string>(".y-axis-label-probeset")
            .attr("fill", (d) =>
                selection.probesetId === d ? "orange" : "var(--text-color)"
            );

        // Update transcript markers based on selection
        this.context.svg
            .selectAll<SVGRectElement, string>(".transcript-marker")
            .attr("fill", (d) => {
                if (selectedProbes.length > 0) {
                    const isSelected = selectedProbes.some((probe) => probe.transcript_ids.includes(d));
                    return isSelected ? "#22bd28" : "#b0b0b0";
                }
                return "transparent";
            })
            .attr("display", selection.probeIds.length > 0 ? "block" : "none");
        
        // If zoomIntoProbe is true, smoothly zoom and pan to center the selected probe
        if (selectedProbes.length > 0 && zoomIntoProbes) {
            const selectionStart = Math.min(...selectedProbes.map((probe) => probe.start));
            const selectionEnd = Math.max(...selectedProbes.map((probe) => probe.end));
            // Smoothly zoom and pan to center the selected probe
            const zoomScale = Math.min(
                (this.context.scaledWidth /
                    (this.context.xScale(selectionEnd) -
                        this.context.xScale(selectionStart))) *
                0.9, // add some padding
                this.context.zoomBehavior.scaleExtent()[1] // don't exceed max zoom
            );
            this.context.plot
                .transition()
                .duration(2500)
                .ease(d3.easeCubicInOut)
                .call(
                    this.context.zoomBehavior.transform,
                    d3.zoomIdentity
                        .translate(this.context.scaledWidth / 2, 0)
                        .scale(zoomScale)
                        .translate(
                            -(
                                (this.context.xScale(selectionStart) +
                                    this.context.xScale(selectionEnd)) /
                                2
                            ),
                            0
                        )
                );
        }

        drawFooter(this.context.footerGroup, this.gene, selection, this.context);
        setupZoom(this.context, this.gene, this.selection, this.visibleProbesetIds);
        // trigger a zoom event to update to update according to the new zoom (selected probe changed => different probe bases to show)
        zoomed(
            { transform: this.context.currentZoomTransform } as d3.D3ZoomEvent<SVGGElement, unknown>,
            this.context,
            this.gene,
            this.selection,
            this.visibleProbesetIds
        );
    }

    /**
     * Exports the current visualization as an SVG file named "gene_viewer.svg".
     */
    public export() {
        exportSVG(this.context.svg.node() as SVGSVGElement, "gene_viewer.svg");
    }

    /**
     * Cleans up the visualization by removing all SVG elements and tooltips, and clearing the context for the given element.
     */
    public destroy () {
        // Clean up the SVG element
        this.context.svg.selectAll("*").remove();
        // Remove tooltip
        this.context.tooltip.remove();
    }
};

export default GeneViewerVisualization;
