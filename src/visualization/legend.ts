import { Gene, ProbeSelection } from "../types.js";
import { RegionMap } from "../constants.js";
import { PADDING_LEFT } from "../visualization.js";

export const drawLegend = (
    legendGroup: d3.Selection<SVGGElement, unknown, null, unknown>,
    gene: Gene,
    selection: ProbeSelection
) => {
    // remove any existing legend items
    legendGroup.selectAll("*").remove();

    // Legend group for probe types and region types
    legendGroup
        .attr("transform", `translate(${PADDING_LEFT}, 0)`)

    // Header for legend (gene name, species, source)
    legendGroup
        .append("text")
        .attr("y", 15)
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(`Gene: ${gene.id}`);

    legendGroup
        .append("text")
        .attr("y", 25)
        .attr("font-size", "8px")
        .text(`Species: ${gene.species || "N/A"}`);

    legendGroup
        .append("text")
        .attr("y", 35)
        .attr("font-size", "8px")
        .text(`Source: ${gene.source || "N/A"}`);

    legendGroup
        .append("text")
        .attr("y", 50)
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text("Probes");

    legendGroup
        .append("text")
        .attr("x", 170)
        .attr("y", 50)
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text("Regions");

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

    const probeItems = legendGroup
        .selectAll(".probe-item")
        .data(probeLegendItems)
        .enter()
        .append("g")
        .attr("class", "probe-item")
        .attr("transform", (d, i) => `translate(${Math.floor(i / 3) * 12}, ${60 + i % 3 * 14})`);

    probeItems
        .append("rect")
        .attr("width", 6)
        .attr("height", 6)
        .attr("fill", (d) => d.color);
        
    probeItems
        .append("text")
        .attr("x", 10)
        .attr("y", 6)
        .attr("font-size", "8px")
        .text((d) => d.label);

    // create legend items for each region type
    const visibleRegionTypes = Object.keys(RegionMap).filter((regionType) => {
        return gene.regions && Object.values(gene.regions).some((regions) => regions.some((region) => region.type === regionType));
    });

    const regionItems = legendGroup
        .selectAll(".region-item")
        .data(visibleRegionTypes)
        .enter()
        .append("g")
        .attr("class", "region-item")
        .attr("transform", (d, i) => `translate(${170 + Math.floor(i / 3) * 12}, ${60 + i % 3 * 14})`);

    regionItems
        .append("rect")
        .attr("width", 6)
        .attr("height", 6)
        .attr("fill", (d) => RegionMap[d].color);

    regionItems
        .append("text")
        .attr("x", 15)
        .attr("y", 6)
        .attr("font-size", "8px")
        .text((d) => RegionMap[d].label);
}
