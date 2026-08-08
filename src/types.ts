export interface Probe {
    id: string;
    start: number;
    end: number;
    transcript_ids: string[];
    description?: string;
    sequence?: string; // mainly useful when no reference sequence is available
    locations: {
        start: number;
        end: number;
    }[] | null; /* null if equal to the probe's start and end positions */
    metadata?: {
        [key: string]: string;
    };
};

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
    weight?: number;
    itemRgb?: string;
    // TODO: transcript_ids?: string[];
    description?: string;
}

export type Track = Feature[];

export interface Tracks {
    [track_name: string]: Track;
}

export interface Gene {
    id: string;
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
