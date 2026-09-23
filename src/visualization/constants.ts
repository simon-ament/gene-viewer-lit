export type RegionMap = { [key: string]: { color: string; label: string } };

export const defaultRegionMap: RegionMap = {
  exon: { color: 'blue', label: 'Exon' },
  intron: { color: 'red', label: 'Intron' },
  intron_CNS: { color: 'lightgray', label: 'Intron CNS' },
  CDS: { color: 'green', label: 'CDS' },
  '3UTR': { color: 'orange', label: "3' UTR" },
  three_prime_UTR: { color: 'orange', label: "3' UTR" },
  '5UTR': { color: 'orange', label: "5' UTR" },
  five_prime_UTR: { color: 'orange', label: "5' UTR" },
  exonexonjunction: { color: 'darkblue', label: 'Start / End of Exon' },
  gene: { color: 'purple', label: 'Gene' },
  inter: { color: 'gray', label: 'Intergenic' },
  inter_CNS: { color: 'lightgray', label: 'Intergenic CNS' },
  start_codon: { color: 'darkgreen', label: 'Start Codon' },
  stop_codon: { color: 'darkred', label: 'Stop Codon' },
  promoter: { color: 'lightblue', label: 'Promoter' },
  enhancer: { color: 'lightgreen', label: 'Enhancer' },
  unknown: { color: 'lightgray', label: 'Unknown' },
};
