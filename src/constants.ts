export const RegionMap: { [key: string]: { color: string; label: string } } = {
    exon: { color: "blue", label: "Exon" },
    intron: { color: "red", label: "Intron" },
    CDS: { color: "green", label: "CDS" },
    three_prime_UTR: { color: "orange", label: "3' UTR" },
    five_prime_UTR: { color: "orange", label: "5' UTR" },
    exonexonjunction: { color: "darkblue", label: "Start / End of Exon" },
    gene: { color: "purple", label: "Gene" },
    unknown: { color: "lightgray", label: "Unknown" },
};
