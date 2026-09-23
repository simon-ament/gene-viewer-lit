import { GeneViewer } from '../index.js';

export interface Probe {
  id: string;
  start: number;
  end: number;
  transcript_ids: string[];
  locations:
    | {
        start: number;
        end: number;
      }[]
    | null; // null if equal to the probe's start and end positions
  description?: string;
  // sequence?: string; // mainly useful when no reference sequence is available
  metadata?: {
    [key: string]: string;
  };
}

export interface Probes {
  [probeset_id: string]: Probe[];
}

export interface Region {
  start: number;
  end: number;
  type: string;
  strand?: string;
  description?: string;
  exon_number?: number;
}

export interface Regions {
  [transcript_id: string]: Region[];
}

export interface Sequence {
  start: number;
  sequence: string;
}

export type Sequences = Sequence[];

export interface Feature {
  start: number;
  end: number;
  opacity?: number;
  item_rgb?: string;
  description?: string;
}

export type Track = Feature[];

export interface Tracks {
  [track_name: string]: Track;
}

export interface Gene {
  id: string;
  seq_id: string;
  start: number;
  end: number;
  strand: '+' | '-';

  species: string | null;
  source: string | null;

  probes: Probes;
  regions: Regions;
  sequences: Sequences;
  tracks: Tracks;
}

export type ProbeSelection = {
  probesetId: string | null;
  probeIds: string[];
};

export type ProbeSetData = {
  probesetId: string;
  probes: Probe[];
};

/* Events */

export type GeneChangedEventDetail = {
  previousGeneId: string | null | undefined;
  newGeneId: string | undefined;
  gene?: {
    probesetIds: string[];
    probeIds: string[];
    probes: Probes;
    source: string | null;
    species: string | null;
    strand: '+' | '-';
    start: number;
    end: number;
    seq_id: string;
  };
};

export type GeneChangedEvent = CustomEvent<GeneChangedEventDetail>;

export type ProbesetsChangedEventDetail = {
  previousProbesetIds: string[] | undefined;
  newProbesetIds: string[];
};

export type ProbesetsChangedEvent = CustomEvent<ProbesetsChangedEventDetail>;

export type ProbesSelectedEventDetail = {
  previousProbeIds: string[] | undefined;
  newProbeIds: string[];
};

export type ProbesSelectedEvent = CustomEvent<ProbesSelectedEventDetail>;

export type ProbesetSelectedEventDetail = {
  previousProbesetId: string | null | undefined;
  newProbesetId: string | null;
};

export type ProbesetSelectedEvent = CustomEvent<ProbesetSelectedEventDetail>;

export type GeneViewerReadyEventDetail = {
  geneViewer: GeneViewer;
  geneList: string[];
};

export type GeneViewerReadyEvent = CustomEvent<GeneViewerReadyEventDetail>;
