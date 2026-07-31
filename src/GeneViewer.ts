import { html, css, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { Gene } from './types.js';
import GeneViewerVisualization from './visualization.js';
import TestData from './test.json' with { type: 'json' };

export class GeneViewer extends LitElement {

    /* Styles */

    static styles = css`
    :host {
        display: block;
        padding: 25px;
        background-color: var(--gene-viewer-background-color, #fff);
    }

    svg .select-none {
        user-select: none;
    }
    `;

    /* Properties */

    @property({ type: String }) viewerServer = '/api/visualization';

    @property({ type: String }) viewerId = '9fec22e5-fbf4-44f2-84d8-b267f1ee1524';

    @property({ type: Number }) parallelProbesets = 1;

    /* State */

    @state()
    protected _gene: Gene | null = null;

    @state()
    protected _visibleProbesetIds: string[] = [];

    @state()
    protected _selectedProbeId: string | null = null;

    @state()
    protected _visualization: GeneViewerVisualization | null = null;

    /* Methods */

    public showGene(geneId: string) {
        
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

    connectedCallback() {
        super.connectedCallback();

        // Load gene data (for now, using test data)
        this._gene = TestData as Gene;
        this._visibleProbesetIds = ["Oligoset 1", "Oligoset 2", "Oligoset 3"];
        this._selectedProbeId = "AARS1::12425";
    }

    firstUpdated() {
        // Initialize the visualization
        this._visualization = new GeneViewerVisualization(
            this.renderRoot.querySelector('article') as HTMLElement,
            this._gene!,
            this._visibleProbesetIds,
            this._selectedProbeId,
            (id: string | null) => { this._selectedProbeId = id; },
            this.parallelProbesets,
        );

        // dispatch `geneViewerReady` event
        this.dispatchEvent(new CustomEvent('geneViewerReady', {
            detail: {
                geneViewer: this,
                geneList: ['AARS1']
            },
            bubbles: true,
            composed: true,
        }));
    }

    update(changedProperties: Map<string, any>) {
        super.update(changedProperties);

        if (changedProperties.has('_gene') && this._gene && this._visualization) {
            this._visualization = new GeneViewerVisualization(
                this.renderRoot.querySelector('article') as HTMLElement,
                this._gene,
                this._visibleProbesetIds,
                this._selectedProbeId,
                (id: string | null) => { this._selectedProbeId = id; },
                this.parallelProbesets
            );
        }

        if (changedProperties.has('_visibleProbesetIds') && this._visualization) {
            this._visualization.showProbesets(this._visibleProbesetIds);
        }

        if (changedProperties.has('_selectedProbeId') && this._visualization) {
            this._visualization.selectProbe(this._selectedProbeId);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._visualization) {
            this._visualization.destroy();
            this._visualization = null;
        }
    }

    /* Render */

    render() {
        if (this._gene) {
            return html`
                <article>
                    <h2>${this.viewerId} from ${this.viewerServer}</h2>
                    <button @click=${() => this._visualization?.export()}>Export SVG</button>
                    <svg />
                    <div>
                        Strand: ${this._gene.strand ?? 'N/A'}<br />
                    </div>
                </article>
            `;
        } else {
            return html`<h2>Loading gene viewer...</h2>`;
        }
    }
}
