import { Gene, ProbeSelection } from "../types.js";
import { RegionMap } from "../constants.js";
import { PADDING_LEFT, PADDING_TOP, VisualizationContext } from "../visualization.js";

export const drawHeader = (
    headerGroup: d3.Selection<SVGGElement, unknown, null, unknown>,
    gene: Gene,
) => {
    // Legend group for probe types and region types
    headerGroup
        .attr("transform", `translate(${PADDING_LEFT}, 15)`)

    // Header for legend (gene name, species, source)
    headerGroup
        .append("text")
        .attr("y", 0)
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(`Gene: ${gene.id}`);

    headerGroup
        .append("text")
        .attr("y", 14)
        .attr("font-size", "8px")
        .text(`Species: ${gene.species || "N/A"} | Source: ${gene.source || "N/A"}`);

    headerGroup
        .append("text")
        .attr("y", 26)
        .attr("font-size", "8px")
        .text(`Location: ${gene.seq_id}:${gene.start}-${gene.end}`);

    headerGroup
        .append("text")
        .attr("y", 38)
        .attr("font-size", "8px")
        .text(`Strand: ${gene.strand}`);
}

export const drawFooter = (
    footerGroup: d3.Selection<SVGGElement, unknown, null, unknown>,
    gene: Gene,
    selection: ProbeSelection,
    context: VisualizationContext
) => {
    // remove any existing legend items
    footerGroup.selectAll("*").remove();

    // Legend group for probe types and region types
    footerGroup
        .attr("transform", `translate(${PADDING_LEFT}, ${context.height + PADDING_TOP + 30})`)

    footerGroup
        .append("text")
        .attr("y", 0)
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text("Probes:");

    footerGroup
        .append("text")
        .attr("y", 15)
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text("Regions:");

    // create legend items for probes
    const probeLegendItems = [
        {
            label: "Probe",
            color: "steelblue",
        }
    ]
    if (selection.probeIds.length > 0) {
        probeLegendItems.push({
            label: "Selected Probe(s)",
            color: "orange",
        });
        probeLegendItems.push({
            label: "Transcript Covered by Selected Probe(s)",
            color: "#22bd28",
        });
    }

    let widthOffset = 0;
    for (const probeLegendItem of probeLegendItems) {
        const probeItem = footerGroup
            .append("g")
            .attr("class", "probe-item")
            .attr("transform", `translate(${40 + widthOffset}, 0)`)

        probeItem
            .append("rect")
            .attr("y", -6)
            .attr("width", 6)
            .attr("height", 6)
            .attr("fill", probeLegendItem.color);

        const probeText = probeItem
            .append("text")
            .attr("x", 10)
            .attr("font-size", "8px")
            .text(probeLegendItem.label);

        widthOffset += probeText.node()!.getBBox().width + 20;
    }

    // create legend items for each region type
    const visibleRegionTypes = Object.keys(RegionMap).filter((regionType) => {
        return gene.regions && Object.values(gene.regions).some((regions) => regions.some((region) => region.type === regionType));
    });

    widthOffset = 0;
    for (const regionType of visibleRegionTypes) {
        const regionItem = footerGroup
            .append("g")
            .attr("class", "region-item")
            .attr("transform", `translate(${40 + widthOffset}, 15)`)

        regionItem
            .append("rect")
            .attr("y", -6)
            .attr("width", 6)
            .attr("height", 6)
            .attr("fill", RegionMap[regionType].color);

        const regionText = regionItem
            .append("text")
            .attr("x", 10)
            .attr("font-size", "8px")
            .text(RegionMap[regionType].label);

        widthOffset += regionText.node()!.getBBox().width + 20;
    }
}
