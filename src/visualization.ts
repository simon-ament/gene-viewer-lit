import * as d3 from "d3";
import type { Region, Probe, Gene, Probes } from "./types.js";
import {
    calculateArrowSpacing,
    centeredMinWidthRect,
    collectProbeBases,
    collectProbeComponents,
    collectReferenceBases,
    exportSVG,
    probeTooltipHTML,
    regionTooltipHTML,
    transcriptTooltipHTML,
    type Base,
    type ProbePosition,
} from "./helpers.js";
import { RegionMap } from "./constants.js";

type VisualizationContext = {
    svg: d3.Selection<SVGElement, unknown, null, unknown>;
    plot: d3.Selection<SVGGElement, unknown, null, unknown>;
    locationIndicator: d3.Selection<SVGRectElement, unknown, null, unknown>;
    positionLabelGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    probesGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    tooltip: d3.Selection<HTMLDivElement, unknown, null, unknown>;
    regionsGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    baseGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    readingGridTicksGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    xScale: d3.ScaleLinear<number, number>;
    xAxis: d3.Selection<SVGGElement, unknown, null, unknown>;
    zoomBehavior: d3.ZoomBehavior<SVGElement, unknown>;
    currentZoomTransform: d3.ZoomTransform;
    height: number;
    parallelProbesets: number;
};

const WIDTH = 800;
const PROBE_HEIGHT = 20;
const TRANSCRIPT_HEIGHT = 20;
const TRANSCRIPT_MARKER_WIDTH = 8;
const GAP = 50;
const AXIS_HEIGHT = 20;
const MIN_PROBE_WIDTH = 2;

/**
 * Creates the D3 visualization context by creating the necessary SVG elements and groups.
 *
 * @param el The container element for the visualization.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const createContext = (
    el: HTMLElement,
    gene: Gene,
    parallelProbesets: number
): VisualizationContext => {
    const svg = d3.select(el).select("svg") as d3.Selection<SVGElement, unknown, null, unknown>;
    const height =
        Object.keys(gene.regions).length * TRANSCRIPT_HEIGHT +
        parallelProbesets * PROBE_HEIGHT +
        GAP +
        AXIS_HEIGHT;

    const plot = svg.append("g");
    const locationIndicator = plot.append("rect");
    const probesGroup = plot.append("g").attr("class", "probes");
    const tooltip = d3.select(el).append("div");
    const regionsGroup = plot.append("g").attr("class", "genomic-regions");
    const baseGroup = plot.append("g");
    const readingGridTicksGroup = plot.append("g");

    const zoomBehavior = d3.zoom() as d3.ZoomBehavior<SVGElement, unknown>;
    const xScale = d3.scaleLinear();
    const xAxis = plot.append("g");
    const positionLabelGroup = plot
        .append("g")
        .attr("id", "position-label-group");
    positionLabelGroup.append("rect");
    positionLabelGroup.append("text");

    return {
        svg,
        plot,
        locationIndicator,
        positionLabelGroup,
        probesGroup,
        tooltip,
        regionsGroup,
        baseGroup,
        readingGridTicksGroup,
        xScale,
        xAxis,
        zoomBehavior,
        currentZoomTransform: d3.zoomIdentity,
        height,
        parallelProbesets,
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
        // TODO: also sequences and tracks?
        ...Object.values(gene.sequences).flat().flatMap((d: { start: number; sequence: string }) => [d.start, d.start + d.sequence.length - 1]),
    ]) as [number, number];
    const extentPadding = (ext[1] - ext[0]) * 0.01; // add % padding on each side
    context.xScale
        .domain([ext[0] - extentPadding, ext[1] + extentPadding])
        .range([1, WIDTH - 1]);
    const axis = d3.axisBottom(context.xScale).ticks(8);

    // Append the x-axis inside the plot area
    context.xAxis
        .attr("class", "x-axis select-none")
        .attr("transform", `translate(0, ${context.height - AXIS_HEIGHT})`)
        .style("font-family", "inherit")
        .call(axis);
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
        .attr("viewBox", [0, 0, WIDTH, context.height])
        .attr("width", WIDTH)
        .attr("height", context.height)
        .attr("style", "width: 100%; height: auto;");

    // Location indicator as vertical bar following the mouse
    context.locationIndicator
        .attr("id", "location-indicator")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", context.xScale(1) - context.xScale(0))
        .attr("height", context.height - AXIS_HEIGHT)
        .attr("fill", "black")
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
        .attr("fill", "black");

    // Position label background
    context.positionLabelGroup
        .select("rect")
        .attr("fill", "var(--gene-viewer-background-color, #fff)")
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
        .attr("id", "region-tooltip")
        .style("background-color", "white")
        .style("border", "1px solid #b0b0b0")
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
            .on("mouseover", function () {
                context.tooltip.style("opacity", 1);
            })
            .on("mousemove", (event, d: Region) => {
                context.tooltip
                    .html(regionTooltipHTML(d, transcriptName))
                    .style(
                        "left",
                        event.pageX > window.innerWidth / 2
                            ? ""
                            : event.pageX + 20 + "px"
                    )
                    .style(
                        "right",
                        event.pageX > window.innerWidth / 2
                            ? window.innerWidth - event.pageX + 10 + "px"
                            : ""
                    )
                    .style("top", event.pageY + "px")
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
                .on("mouseover", function () {
                    context.tooltip.style("opacity", 1);
                })
                .on("mousemove", (event, d) => {
                    context.tooltip
                        .html(transcriptTooltipHTML(d, gene.probes))
                        .style("left", event.pageX + 20 + "px")
                        .style("top", event.pageY + "px")
                        .style("bottom", ""); // reset bottom in case it was set before
                })
                .on("mouseleave", function () {
                    context.tooltip.style("opacity", 0);
                });
        }
    });

    context.baseGroup.attr("class", "reference-bases");
    context.readingGridTicksGroup.attr("class", "reading-grid-ticks");
};

/**
 * Updates the position of the location indicator and its label.
 *
 * @param context The visualization context object.
 * @param xPos The x position (in pixels) where the location indicator should be updated to.
 */
const updateLocationIndicatorAndTooltip = (
    context: VisualizationContext,
    xPos: number
) => {
    const zx = context.currentZoomTransform.rescaleX(context.xScale);
    const domainX = zx.invert(xPos);
    const snapX = Math.floor(domainX + 0.5);
    const x = zx(snapX - 0.5);

    context.locationIndicator.attr("x", x);
    context.positionLabelGroup
        .select("text")
        .attr("x", x + 10) // add some padding from the indicator
        .text(snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")); // insert commas for thousands

    const positionLabelNode = context.positionLabelGroup
        .select("text")
        .node() as SVGTextElement;
    if (!positionLabelNode) {
        return;
    }

    const { x: labelX, y: labelY, width, height } = positionLabelNode.getBBox();
    const paddingRight = 4;
    const paddingLeft = 2;
    const paddingY = 5;
    context.positionLabelGroup
        .select("rect")
        .attr("x", labelX - paddingLeft)
        .attr("y", labelY - paddingY)
        .attr("width", width + paddingLeft + paddingRight)
        .attr("height", height + paddingY * 2);

    // TODO: update tooltip position
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
    setSelectedProbe: (id: string | null) => void,
) => {
    const preventPageScroll: EventListener = (event) => {
        event.preventDefault();
    };
    context.svg
        .on("click", () => setSelectedProbe(null)) // deselect probe when clicking on empty space
        .on("wheel", preventPageScroll, { passive: false }) // some browsers default to passive wheel listeners
        .on("mouseenter", () => {
            context.locationIndicator.attr("visibility", "visible");
            context.positionLabelGroup.attr("visibility", "visible");
        })
        .on("mousemove", (event) => {
            const [xPos] = d3.pointer(event, context.plot.node());
            updateLocationIndicatorAndTooltip(context, xPos);
        })
        .on("mouseleave", () => {
            context.locationIndicator.attr("visibility", "hidden");
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
    selectedProbeId: string | null = null
) => {
    const extent: [[number, number], [number, number]] = [
        [0, 0],
        [WIDTH, context.height],
    ];

    context.zoomBehavior
        .scaleExtent([
            1,
            (context.xScale.domain()[1] - context.xScale.domain()[0]) / 100,
        ]) // max zoom to 100bp width
        .translateExtent(extent)
        .extent(extent)
        .on("zoom", (e) => zoomed(e, context, gene, selectedProbeId));

    context.svg.call(context.zoomBehavior);
};

/**
 * Handles zoom events by rescaling and repositioning all elements in the visualization.
 *
 * @param event The D3 zoom event object containing the current transform.
 * @param context The visualization context object.
 * @param gene The gene data containing regions and probes to be visualized.
 */
const zoomed = (
    event: d3.D3ZoomEvent<SVGElement, unknown>,
    context: VisualizationContext,
    gene: Gene,
    selectedProbeId: string | null = null
) => {
    context.currentZoomTransform = event.transform;
    const zx = event.transform.rescaleX(context.xScale);

    context.locationIndicator.attr("width", zx(1) - zx(0));
    const source = event.sourceEvent;
    const plotNode = context.plot.node();
    if (source instanceof MouseEvent && plotNode) {
        // use mouse position to update location indicator and tooltip
        const [xPos] = d3.pointer(source, plotNode);
        updateLocationIndicatorAndTooltip(context, xPos);
    } else {
        // use last known position of the location indicator
        // TODO: correctly update the location here
        const xPos = Number(context.locationIndicator.attr("x"));
        updateLocationIndicatorAndTooltip(context, xPos);
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
    const axis = d3.axisBottom(zx).ticks(8);
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

    // Calculate visible range
    const domain = zx.domain();
    const visibleRange = domain[1] - domain[0];
    const showBases = visibleRange <= 120;
    const showArrows = visibleRange <= 3000;

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
        .attr("text-anchor", "middle")
        .text((d) => d.char);

    // Show probe bases only when zoomed in and only if in view
    const probeBases = collectProbeBases(
        Object.values(gene.probes).flat().filter((probe) => selectedProbeId ? probe.id === selectedProbeId : true),
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
                d.type !== "intron"
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
    private selectedProbeId: string | null;
    private setSelectedProbe: (id: string | null) => void;
    private context: VisualizationContext;
    private parallelProbesets: number;
    private scaleFactor: number;

    /**
     * Creates a new GeneViewerVisualization instance and initializes the visualization.
     *
     * @param el The container element for the visualization.
     * @param gene The gene object containing probes and regions to be visualized.
     * @param visibleProbesets The list of probesets that should be visible in the visualization.
     * @param selectedProbe The currently selected probe, or null if no probe is selected.
     * @param setSelectedProbe A callback function to set the currently selected probe.
     * @param parallelProbesets The maximum number of probesets to display in parallel.
     * @param scaleFactor The scale factor for the visualization (not currently used).
     */
    constructor(
        el: HTMLElement,
        gene: Gene,
        visibleProbesets: string[],
        selectedProbe: string | null,
        setSelectedProbe: (id: string | null) => void,
        parallelProbesets: number,
        scaleFactor: number
    ) {
        this.gene = gene;
        this.visibleProbesetIds = visibleProbesets;
        this.selectedProbeId = selectedProbe;
        this.setSelectedProbe = setSelectedProbe;
        this.parallelProbesets = Math.min(parallelProbesets, Object.keys(gene.probes).length);
        this.context = createContext(el, gene, this.parallelProbesets);
        this.scaleFactor = scaleFactor;

        this._init();
    }

    /**
     * Orchestrates the initialization of the visualiazation.
     */
    private _init() {
        setupScalesAndAxes(this.context, this.gene);
        setupElements(this.context, this.gene);
        setupMouseEvents(this.context, this.setSelectedProbe);
        setupZoom(this.context, this.gene, this.selectedProbeId);

        this.showProbesets(this.visibleProbesetIds);
        this.selectProbe(this.selectedProbeId);
        
        zoomed(
            { transform: d3.zoomIdentity } as d3.D3ZoomEvent<SVGElement, unknown>,
            this.context,
            this.gene,
            this.selectedProbeId
        );
    }
    
    /**
     * Updates the list of visible probesets in the visualization.
     * 
     * @param visibleProbesets The list of probesets that should be visible in the visualization.
     */
    public showProbesets(visibleProbesets: string[]) {
        this.visibleProbesetIds = visibleProbesets.splice(0, this.parallelProbesets); // limit to the number of parallel probesets

        type ProbeSetData = { probesetId: string; probes: Probe[] };

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
            .on("click", (event, data) => {
                event.stopPropagation(); // prevent click from propagating to svg and deselecting probe
                this.setSelectedProbe(data.id);
                this.selectProbe(data.id, true); // zoom into selected probe (even if already selected)
            })
            .on("mouseover", () => {
                this.context.tooltip.style("opacity", 1);
            })
            .on("mousemove", (event, d) => {
                this.context.tooltip
                    .html(probeTooltipHTML(d, this.gene.regions))
                    .style(
                        "left",
                        event.pageX > window.innerWidth / 2
                            ? ""
                            : event.pageX + 20 + "px"
                    )
                    .style(
                        "right",
                        event.pageX > window.innerWidth / 2
                            ? window.innerWidth - event.pageX + 10 + "px"
                            : ""
                    )
                    .style("bottom", window.innerHeight - event.pageY + "px")
                    .style("top", ""); // reset top in case it was set before
            })
            .on("mouseleave", () => {
                this.context.tooltip.style("opacity", 0);
            });
    }

    /**
     * Updates the currently selected probe in the visualization.
     * 
     * @param selectedProbeId The currently selected probe, or null if no probe is selected.
     * @param zoomIntoProbe A boolean indicating whether to smoothly zoom into the selected probe. Defaults to false.
     */
    public selectProbe(selectedProbeId: string | null, zoomIntoProbe: boolean = false) {
        this.selectedProbeId = selectedProbeId;

        const selectedProbe = selectedProbeId
            ? Object.values(this.gene.probes)
                .flat()
                .find((probe) => probe.id === selectedProbeId)
            : null;

        // Update probe colors based on selection
        this.context.probesGroup
            .selectAll("g.probeset-track")
            .selectAll("g.components")
            .selectAll<SVGRectElement, ProbePosition>("rect")
            .attr("fill", (d) =>
                d.id === selectedProbeId ? "orange" : "steelblue"
            )
            .filter((d) => d.id === selectedProbeId)
            .raise();

        this.context.probesGroup
            .selectAll("g.probeset-track")
            .selectAll("g.probes")
            .selectAll<SVGRectElement, Probe>("rect")
            .attr("fill", (d) =>
                d.id === selectedProbeId ? "orange" : "steelblue"
            )
            .filter((d) => d.id === selectedProbeId)
            .raise();

        // Update transcript markers based on selection
        this.context.svg
            .selectAll<SVGRectElement, string>(".transcript-marker")
            .attr("fill", (d) => {
                if (selectedProbe) {
                    const isSelected = selectedProbe.transcript_ids.includes(d);
                    return isSelected ? "#22bd28" : "#b0b0b0";
                }
                return "transparent";
            })
            .attr("display", selectedProbeId ? "block" : "none");
        
        // If zoomIntoProbe is true, smoothly zoom and pan to center the selected probe
        if (selectedProbe && zoomIntoProbe) {
            // Smoothly zoom and pan to center the selected probe
            const zoomScale = Math.min(
                (WIDTH /
                    (this.context.xScale(selectedProbe.end) -
                        this.context.xScale(selectedProbe.start))) *
                0.9, // add some padding
                this.context.zoomBehavior.scaleExtent()[1] // don't exceed max zoom
            );
            this.context.svg
                .transition()
                .duration(2500)
                .ease(d3.easeCubicInOut)
                .call(
                    this.context.zoomBehavior.transform,
                    d3.zoomIdentity
                        .translate(WIDTH / 2, 0)
                        .scale(zoomScale)
                        .translate(
                            -(
                                (this.context.xScale(selectedProbe.start) +
                                    this.context.xScale(selectedProbe.end)) /
                                2
                            ),
                            0
                        )
                );
        }

        setupZoom(this.context, this.gene, selectedProbeId);
        // trigger a zoom event to update to update according to the new zoom (selected probe changed => different probe bases to show)
        zoomed(
            { transform: this.context.currentZoomTransform } as d3.D3ZoomEvent<SVGElement, unknown>,
            this.context,
            this.gene,
            selectedProbeId
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
