import { html, css, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import {map} from 'lit/directives/map.js';
import { Gene } from './types.js';
import GeneViewerVisualization from './visualization.js';

class GeneViewerBase extends LitElement {

    /* Styles */

    static styles = css`
    :host {
        display: block;
        padding: 2rem;
        background-color: var(--gene-viewer-background-color, #fff);
        color: var(--gene-viewer-text-color, #000);
        border: 1px solid var(--gene-viewer-border-color, #888);
        border-radius: 1rem;
        margin: 1rem;
    }

    svg .select-none {
        user-select: none;
    }

    .export-button {
        margin-bottom: 1rem;
        padding: 0.5rem 1rem;
        background-color: var(--gene-viewer-background-color, #fff);
        color: var(--gene-viewer-text-color, #000);
        border: 1px solid var(--gene-viewer-border-color, #888);
        border-radius: 0.3rem;
        cursor: pointer;
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
    protected _selectedProbeId: string | null = null;

    @state()
    protected _visualization: GeneViewerVisualization | null = null;

    /* Queries */

    @query('article')
    protected _articleElement!: HTMLElement;

    /* Methods */

    protected setGene(gene: Gene | null) {
        this._gene = gene;
    }

    public showProbesets(probesetIds: string[]) {
        this._visibleProbesetIds = probesetIds;
        if (this._visualization) {
            this._visualization.showProbesets(probesetIds);
        }
    }

    public selectProbe(probeId: string) {
        this._selectedProbeId = probeId;
        if (this._visualization) {
            this._visualization.selectProbe(probeId);
        }
    }

    /* Lifecycle */

    update(changedProperties: Map<string, any>) {
        super.update(changedProperties);

        if (changedProperties.has('_visibleProbesetIds') && this._visualization) {
            this._visualization.showProbesets(this._visibleProbesetIds);
        }

        if (changedProperties.has('_selectedProbeId') && this._visualization) {
            this._visualization.selectProbe(this._selectedProbeId);
        }
    }

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        // If the gene has changed, re-initialize the visualization
        if (changedProperties.has('_gene')) {
            if (!this._gene) {
                if (this._visualization) {
                    this._visualization.destroy();
                    this._visualization = null;
                }
                return;
            }

            if (this._visualization) {
                this._visualization.destroy();
            }
            this._visualization = new GeneViewerVisualization(
                this._articleElement,
                this._gene,
                this._visibleProbesetIds,
                this._selectedProbeId,
                (id: string | null) => { this._selectedProbeId = id; },
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

        if (changedProperties.has('_selectedProbeId')) {
            this.dispatchEvent(new CustomEvent('probeSelected', {
                detail: { previousProbeId: changedProperties.get('_selectedProbeId'), newProbeId: this._selectedProbeId },
                bubbles: true,
                composed: true
            }));
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
        const selectableProbesets = this._gene ? Object.keys(this._gene.probes).filter((id) => !this._visibleProbesetIds.includes(id)) : [];
        const range = Array.from({ length: this.parallelProbesets }, (_, i) => i);

        return html`
            <div class="probeset-selectors">
                ${map(range, (index) => html`
                    <select @change=${(e: Event) => {
                        const selectElement = e.target as HTMLSelectElement;
                        const selectedId = selectElement.value;
                        const newVisibleProbesets = [...this._visibleProbesetIds];
                        newVisibleProbesets[index] = selectedId;
                        this.showProbesets(newVisibleProbesets);
                    }}>
                        <option selected value=${this._visibleProbesetIds[index]}>${this._visibleProbesetIds[index]}</option>
                        ${map(selectableProbesets, (probesetId) => html`
                            <option value=${probesetId}>${probesetId}</option>
                        `)}
                    </select>
                `)}
            </div>
        `
    }

    renderExportButton() {
        return html`
            <button class="export-button" @click=${() => this._visualization?.export()}>Export SVG</button>
        `;
    }

    render() {
        return html`
            ${this.renderExportButton()}
            ${this.renderProbesetSelectors()}
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

    render() {
        if (!this._geneId || !this._geneList || !this._gene) {
            return html`<h2>Loading gene data...</h2>`;
        }

        return html`
            <gene-list-autocomplete
                .selectedGene=${this._geneId}
                .geneList=${this._geneList}
                @gene-selected=${(e: CustomEvent) => this.showGene(e.detail.geneId)}
            ></gene-list-autocomplete>
            ${super.render()}
        `;
    }
}
