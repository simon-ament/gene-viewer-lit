import { html, css, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import {map} from 'lit/directives/map.js';
import { Gene, ProbeSelection } from './types.js';
import GeneViewerVisualization from './visualization.js';
import { defaultRegionMap, RegionMap } from './constants.js';

class GeneViewerBase extends LitElement {

    /* Styles */

    static styles = css`
    :host {
        --background-color: var(--gene-viewer-background-color, #fff);
        --text-color: var(--gene-viewer-text-color, #000);
        --border-color: var(--gene-viewer-border-color, #888);

        display: block;
        background-color: var(--background-color);
        color: var(--text-color);
    }

    svg .select-none {
        user-select: none;
    }

    .export-button {
        background-color: var(--background-color);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        cursor: pointer;
        font-weight: normal;
    }

    .export-button svg {
        width: 1.2em;
        height: 1.2em;
        vertical-align: middle;
        margin-right: 0.3em;
    }

    .probeset-selectors {
        display: flex;
        gap: 1em;
    }

    .probeset-selectors select {
        border: 1px solid var(--border-color, #888);
        background-color: var(--background-color, #fff);
        color: var(--text-color, #000);
    }

    .controls-container {
        position: relative;
        container-name: controls;
        container-type: inline-size;
    }

    @container controls {
        .controls {
            /* Controls scale with the visualization, but have a maximum font size to prevent them from becoming too large */
            font-size: min(0.8rem, calc(1cqw * var(--scale-factor, 1)));
        }
    }

    .controls-col > h3 {
        margin: 0;
        margin-bottom: 0.1em;
        font-size: 1.3em;
        font-weight: bold;
    }

    .controls-col input, .controls-col select, .controls-col button {
        font-size: 1.3em;
        padding: 0.7em 1em;
        border-radius: 0.5em;
    }

    .controls-col button:hover {
        background-color: color(from contrast-color(var(--background-color)) srgb r g b / 0.05);
    }

    .controls-col gene-list-autocomplete {
        --input-padding: 0.7em 1em;
        --input-font-size: 1.3em;
    }

    .controls {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        gap: 2em;
    }
    `;

    /* Properties */

    @property({ type: Number }) parallelProbesets = 1;

    @property({ type: Number }) scaleFactor = 1.0;

    @property({ type: Object }) regionMap: RegionMap | null = null;

    /* State */

    @state()
    protected _gene: Gene | null = null;

    @state()
    protected _visibleProbesetIds: string[] = [];

    @state()
    protected _selection: ProbeSelection = { probesetId: null, probeIds: [] };

    @state()
    protected _visualization: GeneViewerVisualization | null = null;

    @state()
    protected _isHelpVisible: boolean = false; // TODO: Implement help toggle functionality

    /* Queries */

    @query('article')
    protected _articleElement!: HTMLElement;

    /* Methods */

    protected _setGene(gene: Gene | null) {
        this._gene = gene;
    }

    public showProbesets(probesetIds: string[]) {
        this._visibleProbesetIds = probesetIds; // trigger update() to update the visualization
    }

    public selectProbe(probeId: string | null) {
        this._selection = { probesetId: null, probeIds: probeId ? [probeId] : [] }; // trigger update() to update the visualization
    }

    public selectProbeset(probesetId: string) {
        const probeIds = this._gene && this._gene.probes[probesetId] ? Object.keys(this._gene.probes[probesetId]) : [];
        this._selection = { probesetId: probesetId, probeIds: probeIds }; // trigger update() to update the visualization
    }

    /* Lifecycle */

    willUpdate(changedProperties: Map<string, any>) {
        super.willUpdate(changedProperties);

        if (changedProperties.has('_gene')) {
            if (!this._gene) {
                return;
            }

            if (this._visibleProbesetIds.length === 0) {
                /// can be overriden by update()
                this._visibleProbesetIds = Object.keys(this._gene.probes).slice(0, this.parallelProbesets);
            }
        }
    }

    update(changedProperties: Map<string, any>) {
        super.update(changedProperties);

        if (changedProperties.has('_gene') && this._visualization) {
            this._visualization.destroy();
            this._visualization = null;
            this._visibleProbesetIds = [];
        }

        if (changedProperties.has('_visibleProbesetIds') && this._visualization) {
            this._visualization.showProbesets(this._visibleProbesetIds);
            this.selectProbe(null); // reset selected probe when probesets change
        }

        if (changedProperties.has('_selection') && this._visualization) {
            this._visualization.select(this._selection);
        }
    }

    firstUpdated() {
        // set --scale-factor CSS variable for use in container queries
        this.style.setProperty('--scale-factor', this.scaleFactor.toString());
    }

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        // If the gene has changed, re-initialize the visualization
        if (changedProperties.has('_gene')) {
            if (this._gene) {
                const mergedRegionMap = { ...defaultRegionMap, ...this.regionMap };
                this._visualization = new GeneViewerVisualization(
                    this._articleElement,
                    this._gene,
                    this._visibleProbesetIds,
                    this._selection,
                    (selection: ProbeSelection) => { this._selection = selection; },
                    this.parallelProbesets,
                    this.scaleFactor,
                    mergedRegionMap
                );
            }

            this.dispatchEvent(new CustomEvent('geneChanged', {
                detail: {
                    previousGeneId: changedProperties.get('_geneId'),
                    newGeneId: this._gene ? this._gene.id : null,
                    geneDetails: {
                        probesetIds: this._gene ? Object.keys(this._gene.probes) : [],
                        probeIds: this._gene ? Object.values(this._gene.probes).flatMap(probes => probes.map(probe => probe.id)) : [],
                        probes: this._gene ? this._gene.probes : {},
                    }
                },
                bubbles: true,
                composed: true
            }));
        }

        if (changedProperties.has('_visibleProbesetIds')) {
            this.dispatchEvent(new CustomEvent('probesetsChanged', {
                detail: { previousProbesetIds: changedProperties.get('_visibleProbesetIds'), newProbesetIds: this._visibleProbesetIds },
                bubbles: true,
                composed: true
            }));
        }

        if (changedProperties.has('_selection')) {
            const previousSelection = changedProperties.get('_selection') as ProbeSelection | undefined;
            const probesetChanged = previousSelection?.probesetId !== this._selection.probesetId;

            this.dispatchEvent(new CustomEvent('probesSelected', {
                detail: { previousProbeIds: previousSelection?.probeIds, newProbeIds: this._selection.probeIds },
                bubbles: true,
                composed: true
            }));

            if (probesetChanged) {
                this.dispatchEvent(new CustomEvent('probesetSelected', {
                    detail: { previousProbesetId: previousSelection?.probesetId, newProbesetId: this._selection.probesetId },
                    bubbles: true,
                    composed: true
                }));
            }
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._visualization) {
            this._visualization.destroy();
        }
    }

    /* Render */

    renderViewer() {
        return html`
            <article>
                ${this._gene ? html`<svg />` : html`<p>Loading gene viewer...</p>`}
            </article>
        `;
    }

    renderProbesetSelectors() {
        if (!this._gene || !this._gene.probes || Object.keys(this._gene.probes).length === 0) {
            return html``;
        }
        const range = Array.from({ length: this.parallelProbesets }, (_, i) => i);
        const probesetIds = Object.keys(this._gene.probes);

        return html`
            <div class="controls-col">
                <h3>Select Probsets</h3>
                <div class="probeset-selectors">
                    ${map(range, (index) => html`
                        <select @change=${(e: Event) => {
                            const selectElement = e.target as HTMLSelectElement;
                            const selectedId = selectElement.value;
                            const newVisibleProbesets = [...this._visibleProbesetIds];
                            newVisibleProbesets[index] = selectedId;
                            this.showProbesets(newVisibleProbesets);
                        }}>
                            ${map(probesetIds, (probesetId) => html`
                                <option .selected=${probesetId === this._visibleProbesetIds[index]} value=${probesetId}>${probesetId}</option>
                            `)}
                        </select>
                    `)}
                </div>
            </div>
        `
    }

    renderExportButton() {
        return html`
            <div class="controls-col">
                <h3>Export</h3>
                <button class="export-button" @click=${() => this._visualization?.export()}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    SVG
                </button>
            </div>
        `;
    }

    renderControls() {
        return html`
            <div class="controls-container">
                <div class="controls">
                ${this.renderProbesetSelectors()}
                ${this.renderExportButton()}
                </div>
            </div>
        `;
    }

    render() {
        return html`
            ${this.renderControls()}
            ${this.renderViewer()}
        `;
    }
}

export class GeneViewerCustom extends GeneViewerBase {

    /* Methods */

    public setGene(gene: Gene) {
        super._setGene(gene);
    }
}

export class GeneViewer extends GeneViewerBase {

    /* Properties */

    @property({ type: String }) viewerServer: string | undefined;

    @property({ type: String }) viewerId: string | undefined;

    /* State */

    @state()
    protected _geneId: string | null = null;

    @state()
    protected _geneList: string[] | null = null;

    @state()
    protected _fetchedData: { geneList?: string[]; geneId?: string; gene: Gene } | null = null;

    @state()
    protected _error: string | null = null;

    /* Data Fetching */

    private _fetchGeneListTask = async (geneId: string | null) => {
        const response = await fetch(`${this.viewerServer}?viewer_id=${this.viewerId}&gene_id=${geneId || ""}`);
        if (!response.ok) {
            let message = `Request failed with status ${response.status}`;
            try {
                const data = await response.json() as { error?: string };
                if (data.error) {
                    message = data.error;
                }
            } catch {
                // Use the status message when the response is not valid JSON.
            }
            throw new Error(message);
        }
        if (geneId === null) {
            const { geneList, gene } = await response.json() as { geneList: string[]; gene: Gene };
            this._setGeneList(geneList);
            this._setGene(gene);
            this.showGene(gene.id);
        } else {
            const { gene } = await response.json() as { gene: Gene };
            this._setGene(gene);
        }
        this._error = null; // clear any previous error
    }

    /* Methods */

    public showGene(geneId: string) {
        this._geneId = geneId; // trigger updated() to fetch gene data
    }

    protected _setGeneList(geneList: string[]) {
        this._geneList = geneList;
    }

    /* Lifecycle */

    update(changedProperties: Map<string, any>) {
        super.update(changedProperties);

        if (changedProperties.has('viewerServer')) {
            if (!this.viewerServer) {
                throw new Error('viewerServer must be provided');
            }
        }

        if (changedProperties.has('viewerId')) {
            if (!this.viewerId) {
                throw new Error('viewerId must be provided');
            }
        }

        if (changedProperties.has('_geneId')) {
            // prevent unnecessary fetches when appropriate gene is already loaded
            if (this._geneId !== this._gene?.id) {
                this._setGene(null); // reset gene to null to show loading state
            }
        }
    }

    firstUpdated() {
        super.firstUpdated();

        this._fetchGeneListTask(null).catch(error => {
            this._error = `Error fetching visualization data: ${error.message}`;
            console.error('Error fetching gene list:', error);
        });
    }

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        if (changedProperties.has('_geneId')) {
            // fetch without geneId is done in firstUpdated() + prevent unecessary fetches when appropriate gene is already loaded
            if (this._geneId && this._geneId !== this._gene?.id) {
                this._fetchGeneListTask(this._geneId).catch(error => {
                    this._error = `Error fetching visualization data: ${error.message}`;
                    console.error('Error fetching gene data:', error);
                })
            }
        }

        if (changedProperties.has('_geneList') && this._geneList) {
            // gene viewer has been initialized with a gene list
            this.dispatchEvent(new CustomEvent('geneViewerReady', {
                detail: { geneViewer: this, geneList: this._geneList },
                bubbles: true,
                composed: true
            }));
        }
    }

    /* Render */

    renderGeneListAutocomplete() {
        if (!this._geneList) {
            return html``;
        }

        return html`
            <div class="controls-col">
                <h3>Select Gene</h3>
                <gene-list-autocomplete
                    .selectedGene=${this._geneId}
                    .geneList=${this._geneList}
                    @gene-selected=${(e: CustomEvent) => this.showGene(e.detail.geneId)}
                ></gene-list-autocomplete>
            </div>
        `;
    }

    renderControls() {
        return html`
            <div class="controls-container">
                <div class="controls">
                    ${this.renderGeneListAutocomplete()}
                    ${this.renderProbesetSelectors()}
                    ${this.renderExportButton()}
                </div>
            </div>
        `;
    }

    render() {
        if (this._error) {
            return html`<p style="color: red;">${this._error}</p>`;
        }

        if (!this._geneId || !this._geneList || !this._gene) {
            return html`<p>Loading gene viewer...</p>`;
        }

        return super.render();
    }
}
