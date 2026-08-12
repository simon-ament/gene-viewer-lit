import type { Region, Regions, Probe, Gene, Probes, Feature } from "./types.js";
import { RegionMap } from "./constants.js";

export type ProbePosition = {
    start: number;
    end: number;
    id: string;
    transcript_ids: string[];
};

export type Base = { char: string; position: number };

/**
 * Generates HTML content for tooltips when hovering an probe.
 *
 * @param probe The probe for which the tooltip is being generated.
 * @param regions The regions that may be relevant for the tooltip content, used to determine how many transcripts match the probe.
 * @returns A string containing HTML content for the tooltip.
 */
export const probeTooltipHTML = (
    probe: Probe,
    regions: Regions
) => {
    const matchingTranscripts = probe.transcript_ids.length;
    const totalTranscripts = Object.keys(regions).length;
    return (
        probe.id +
        (matchingTranscripts !== 0
            ? "<br>Transcripts:<br>" +
            (matchingTranscripts < 10
                ? probe.transcript_ids.join(", ")
                : `${matchingTranscripts} of ${totalTranscripts} transcripts match this probe`)
            : "")
    );
};

/**
 * Generates HTML content for tooltips when hovering a region.
 *
 * @param region The region for which the tooltip is being generated.
 * @param transcriptName The name of the transcript associated with the region.
 * @returns A string containing HTML content for the tooltip.
 */
export const regionTooltipHTML = (
    region: Region,
    transcriptName: string
) => {
    return (
        RegionMap[region.type || "unknown"].label +
        (region.exon_number ? " " + region.exon_number : "") +
        (region.description ? `<br>${region.description}` : "") +
        (transcriptName !== "unknown"
            ? `<br>Transcript: ${transcriptName}`
            : "")
    );
};

/**
 * Generates HTML content for tooltips when hovering a transcript.
 *
 * @param transcriptId The ID of the transcript for which the tooltip is being generated.
 * @param probes The probes that may be relevant for the tooltip content, used to determine which probes match the transcript.
 * @returns A string containing HTML content for the tooltip.
 */
export const transcriptTooltipHTML = (
    transcriptId: string,
    probes: Probes,
) => {
    const matchingProbes = Object.values(probes).flat().filter((probe) =>
        probe.transcript_ids.includes(transcriptId)
    );
    const uniqueProbeIds = Array.from(new Set(matchingProbes.map((o) => o.id)));
    return (
        `Transcript: ${transcriptId}` +
        "<br>Matching Probes:<br>" +
        (uniqueProbeIds.length < 10
            ? uniqueProbeIds.join(", ")
            : `${uniqueProbeIds.length} probes match this transcript`)
    );
};

/**
 * Generates HTML content for tooltips when hovering a feature.
 *
 * @param feature The feature for which the tooltip is being generated.
 * @returns A string containing HTML content for the tooltip.
 */
export const featureTooltipHTML = (feature: Feature) => {
    return (
        `Feature: ${feature.description || "unknown"}`
    );
}

/**
 * Calculates the spacing between arrows in the visualization based on the visible range of the region, avoiding overcrowding.
 *
 * @param visibleRange The length of the currently visible range in the visualization (right edge - left edge).
 * @returns The desired distance between arrows.
 */
export const calculateArrowSpacing = (visibleRange: number) => {
    if (visibleRange <= 150) return 10;
    if (visibleRange <= 300) return 20;
    if (visibleRange <= 600) return 40;
    if (visibleRange <= 1200) return 80;
    return 160;
};

/**
 * Collects the reference bases (one base per position) from the regions that overlap with the specified range.
 *
 * @param gene The regions from which to collect bases.
 * @param start The start position of the range for which to collect bases.
 * @param end The end position of the range for which to collect bases.
 * @returns An array of Base objects representing the collected bases and their positions.
 */
export const collectReferenceBases = (
    gene: Gene,
    start: number,
    end: number,
): Base[] => {
    const visibleSequences = gene.sequences.filter((sequence) =>
        sequence.start <= end && sequence.start + sequence.sequence.length >= start
    );
    visibleSequences.sort((a, b) => a.start - b.start);
    let collectingPosition = start;
    const bases: Base[] = [];

    visibleSequences.forEach((sequence) => {
        if (collectingPosition >= sequence.start + sequence.sequence.length + 1) {
            return; // already collected this sequence
        }
        if (collectingPosition > end) {
            return; // beyond desired end
        }

        // Start collecting from the max of current collecting position or region start
        const regionStartPos = Math.max(collectingPosition, sequence.start);
        for (let pos = regionStartPos; pos <= sequence.start + sequence.sequence.length && pos <= end; pos++) {
            bases.push({
                char: sequence.sequence[pos - sequence.start],
                position: pos,
            });
        }
        collectingPosition = sequence.start + sequence.sequence.length + 1;
    });

    return bases;
};

/**
 * Collects the bases from the specified probes that overlap with the given range.
 *
 * @param probes The array of probes from which to collect bases.
 * @param start The start position of the range for which to collect bases.
 * @param end The end position of the range for which to collect bases.
 * @returns An array of Base objects representing the collected bases and their positions.
 */
export const collectProbeBases = (
    probes: Probe[],
    referenceBases: Base[],
    start: number,
    end: number,
): Base[] => {
    const visibleProbes = probes.filter((probe) =>
        probe.end >= start && probe.start <= end
    );
    visibleProbes.sort((a, b) => a.start - b.start);
    let collectingPosition = start;
    const bases: Base[] = [];
    
    visibleProbes.forEach((probe) => {
        if (collectingPosition >= probe.end + 1) {
            return; // already collected this probe
        }
        if (collectingPosition > end) {
            return; // beyond desired end
        }

        // Start collecting from the max of current collecting position or probe start
        const probeStartPos = Math.max(collectingPosition, probe.start);
        for (let pos = probeStartPos; pos <= probe.end && pos <= end; pos++) {
            const referenceBase = referenceBases.find((base) => base.position === pos);
            if (referenceBase) {
                bases.push({
                    char: referenceBase.char,
                    position: pos,
                });
            }
        }
        collectingPosition = probe.end + 1;
    });

    return bases;
};

/**
 * Collects the positions of probe components (probes and gaps) from the provided probes.
 *
 * @param probes The array of probes from which to collect probe components.
 * @returns An array of ProbePosition objects representing the positions and details of the probe components.
 */
export const collectProbeComponents = (probes: Probe[]): ProbePosition[] => {
    return probes.flatMap((probe) =>
        probe.locations ? probe.locations.map((component) => ({
            start: component.start,
            end: component.end,
            id: probe.id,
            transcript_ids: probe.transcript_ids,
        })) : [{
            start: probe.start,
            end: probe.end,
            id: probe.id,
            transcript_ids: probe.transcript_ids,
        }]
    );
};

/**
 * Computes the reverse complement of a base sequence (consisting of A, T, C, G).
 *
 * @param sequence The input base sequence for which to compute the reverse complement.
 * @returns The reverse complement of the input sequence.
 */
export const reverseComplement = (sequence: string): string => {
    return sequence
        .split("")
        .reverse()
        .map((base) => {
            switch (base) {
                case "A":
                    return "T";
                case "T":
                    return "A";
                case "C":
                    return "G";
                case "G":
                    return "C";
                default:
                    return base;
            }
        })
        .join("");
};

/**
 * Calculates the x position and width for a probe rectangle, ensuring a minimum width for visibility while keeping it centered on the probe's actual position.
 *
 * @param startX - The x position corresponding to the start of the probe.
 * @param endX - The x position corresponding to the end of the probe.
 * @param minWidth - The minimum width for the probe rectangle to ensure visibility.
 * @returns An object containing the adjusted x position and width for the probe rectangle.
 */
export const centeredMinWidthRect = (
    startX: number,
    endX: number,
    minWidth: number
) => {
    const width = endX - startX;
    if (width >= minWidth) {
        return { x: startX, width };
    }

    const center = (startX + endX) / 2;
    return {
        x: center - minWidth / 2,
        width: minWidth,
    };
};

/**
 * Exports the given SVG element as an SVG file, allowing users to download the visualization.
 * 
 * @param el The SVG element to be exported as a file.
 * @param filename The name of the file to be downloaded.
 */

export const exportSVG = (
    el: SVGElement,
    filename: string,
) => {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(el);

    // replace CSS variables with their computed values
    const computedStyles = getComputedStyle(el);
    const cssVariables = Array.from(computedStyles).filter((prop) => prop.startsWith("--"));
    let svgStringWithComputedStyles = svgString;

    console.log("CSS Variables:", cssVariables);

    cssVariables.forEach((variable) => {
        const value = computedStyles.getPropertyValue(variable).trim();
        const regex = new RegExp(`var\\(${variable}\\)`, "g");
        svgStringWithComputedStyles = svgStringWithComputedStyles.replace(regex, value);
    });

    // replace font-family with computed value
    const fontFamily = computedStyles.getPropertyValue("font-family").replace(/"/g, "'").trim();
    svgStringWithComputedStyles = svgStringWithComputedStyles.replace(/font-family="[^"]*"/g, `font-family="${fontFamily}"`);
    svgStringWithComputedStyles = svgStringWithComputedStyles.replace(/font-family:[^;"]*;/g, `font-family: ${fontFamily};`);

    const blob = new Blob([svgStringWithComputedStyles], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
