import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Gene, GeneViewerReadyEventDetail } from './visualization/types.js';
import './GeneListAutocomplete.js';
import { GeneViewerBase } from './GeneViewerBase.js';

@customElement('gene-viewer')
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
  protected _fetchedData: {
    geneList?: string[];
    geneId?: string;
    gene: Gene;
  } | null = null;

  @state()
  protected _error: string | null = null;

  /* Data Fetching */

  private _fetchGeneListTask = async (geneId: string | null) => {
    const response = await fetch(
      `${this.viewerServer}?viewer_id=${this.viewerId}&gene_id=${geneId || ''}`,
    );
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const data = (await response.json()) as { error?: string };
        if (data.error) {
          message = data.error;
        }
      } catch {
        // Use the status message when the response is not valid JSON.
      }
      throw new Error(message);
    }
    if (geneId === null) {
      const { geneList, gene } = (await response.json()) as {
        geneList: string[];
        gene: Gene;
      };
      this._setGeneList(geneList);
      this._setGene(gene);
      this.showGene(gene.id);
    } else {
      const { gene } = (await response.json()) as { gene: Gene };
      this._setGene(gene);
    }
    this._error = null; // clear any previous error
  };

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
    });
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('_geneId')) {
      // fetch without geneId is done in firstUpdated() + prevent unecessary fetches when appropriate gene is already loaded
      if (this._geneId && this._geneId !== this._gene?.id) {
        this._fetchGeneListTask(this._geneId).catch(error => {
          this._error = `Error fetching visualization data: ${error.message}`;
        });
      }
    }

    if (changedProperties.has('_geneList') && this._geneList) {
      // gene viewer has been initialized with a gene list
      this.dispatchEvent(
        new CustomEvent<GeneViewerReadyEventDetail>('geneViewerReady', {
          detail: { geneViewer: this, geneList: this._geneList },
          bubbles: true,
          composed: true,
        }),
      );
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
          ${this.renderGeneListAutocomplete()} ${this.renderProbesetSelectors()}
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

declare global {
  interface HTMLElementTagNameMap {
    'gene-viewer': GeneViewer;
  }
}
