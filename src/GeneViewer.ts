import { html, css, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import {map} from 'lit/directives/map.js';
import { Gene, ProbeSelection } from './types.js';
import GeneViewerVisualization from './visualization.js';

class GeneViewerBase extends LitElement {

    /* Styles */

    static styles = css`
    :host {
        --background-color: var(--gene-viewer-background-color, #fff);
        --text-color: var(--gene-viewer-text-color, #000);
        --border-color: var(--gene-viewer-border-color, #888);

        display: block;
        padding: 2rem;
        background-color: var(--background-color);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 1rem;
        margin: 1rem;
    }

    svg .select-none {
        user-select: none;
    }

    .export-button {
        margin-bottom: 1rem;
        padding: 0.5rem 1rem;
        background-color: var(--background-color);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 0.3rem;
        cursor: pointer;
        font-weight: normal;
    }

    .export-button svg {
        width: 1rem;
        height: 1rem;
        vertical-align: middle;
        margin-right: 0.2rem;
    }

    .probeset-selectors {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .probeset-selectors select {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color, #888);
        background-color: var(--background-color, #fff);
        color: var(--text-color, #000);
        border-radius: 0.3rem;
    }

    .relative-container {
        position: relative;
    }

    .controls-container > h3 {
        margin: 0;
        margin-bottom: 0.4rem;
        font-size: 0.9rem;
        font-weight: bold;
    }

    .controls {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        gap: 2rem;
    }

    @media (max-width: 1024px) {
        .controls {
            position: static;
            flex-direction: column;
            gap: 0;
            margin-bottom: 1rem;
        }
    }
    `;

    /* Properties */

    @property({ type: Number }) parallelProbesets = 1;

    @property({ type: Number }) scaleFactor = 1.0;

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

    protected setGene(gene: Gene | null) {
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

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        // If the gene has changed, re-initialize the visualization
        if (changedProperties.has('_gene')) {
            if (!this._gene) {
                return;
            }

            this._visualization = new GeneViewerVisualization(
                this._articleElement,
                this._gene,
                this._visibleProbesetIds,
                this._selection,
                (selection: ProbeSelection) => { this._selection = selection; },
                this.parallelProbesets,
                this.scaleFactor
            );
        }

        if (changedProperties.has('_visibleProbesetIds')) {
            this.dispatchEvent(new CustomEvent('probesetsChanged', {
                detail: { previousProbesetIds: changedProperties.get('_visibleProbesetIds'), newProbesetIds: this._visibleProbesetIds },
                bubbles: true,
                composed: true
            }));
        }

        if (changedProperties.has('_selection')) {
            const previousSelection = changedProperties.get('_selection') as ProbeSelection;
            const probesetChanged = previousSelection.probesetId !== this._selection.probesetId;

            this.dispatchEvent(new CustomEvent('probesSelected', {
                detail: { previousProbeIds: previousSelection.probeIds, newProbeIds: this._selection.probeIds },
                bubbles: true,
                composed: true
            }));

            if (probesetChanged) {
                this.dispatchEvent(new CustomEvent('probesetSelected', {
                    detail: { previousProbesetId: previousSelection.probesetId, newProbesetId: this._selection.probesetId },
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
                ${this._gene ? html`<svg />` : html`<h2>Loading gene viewer...</h2>`}
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
            <div class="controls-container">
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
            <div class="controls-container">
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
            <div class="relative-container">
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
        super.setGene(gene);
    }
}

export class GeneViewer extends GeneViewerBase {

    /* Properties */

    @property({ type: String }) viewerServer = '/api/visualization';

    @property({ type: String }) viewerId = '9fec22e5-fbf4-44f2-84d8-b267f1ee1524';

    /* State */

    @state()
    protected _geneId: string | null = null;

    @state()
    protected _geneList: string[] | null = null;

    @state()
    protected _fetchedData: { geneList?: string[]; geneId?: string; gene: Gene } | null = null;

    /* Data Fetching */

    private _fetchGeneListTask = async (geneId: string | null) => {
        const response = await fetch(`${this.viewerServer}?viewer_id=${this.viewerId}&gene_id=${geneId || ""}`);
        if (!response.ok) { throw new Error(`Failed to fetch gene list: ${response.status} ${response.statusText}`); }
        if (geneId === null) {
            const { geneList, gene } = await response.json() as { geneList: string[]; gene: Gene };
            this.setGeneList(geneList);
            this.setGene(gene);
            this.showGene(gene.id);
        } else {
            const { gene } = await response.json() as { gene: Gene };
            this.setGene(gene);
        }
    }

    /* Methods */

    showGene(geneId: string) {
        this._geneId = geneId; // trigger updated() to fetch gene data
    }

    setGeneList(geneList: string[]) {
        this._geneList = geneList;
    }

    /* Lifecycle */

    update(changedProperties: Map<string, any>) {
        super.update(changedProperties);

        if (changedProperties.has('_geneId')) {
            this.setGene(null); // reset gene to null to show loading state
        }
    }

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        if (changedProperties.has('_geneId')) {
            this._fetchGeneListTask(this._geneId).catch(error => {
                console.error('Error fetching gene data:', error);
            });

            this.dispatchEvent(new CustomEvent('geneChanged', {
                detail: { previousGeneId: changedProperties.get('_geneId'), newGeneId: this._geneId },
                bubbles: true,
                composed: true
            }));
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
            <div class="controls-container">
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
            <div class="relative-container">
                <div class="controls">
                    ${this.renderGeneListAutocomplete()}
                    ${this.renderProbesetSelectors()}
                    ${this.renderExportButton()}
                </div>
            </div>
        `;
    }

    render() {
        if (!this._geneId || !this._geneList || !this._gene) {
            return html`<h2>Loading gene data...</h2>`;
        }

        return super.render();
    }
}
