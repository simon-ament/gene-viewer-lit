import { Gene } from './visualization/types.js';
import './GeneListAutocomplete.js';
import { GeneViewerBase } from './GeneViewerBase.js';

export class GeneViewerCustom extends GeneViewerBase {
  /* Methods */

  public setGene(gene: Gene) {
    super._setGene(gene);
  }
}

if (!customElements.get('gene-viewer-custom')) {
  customElements.define('gene-viewer-custom', GeneViewerCustom);
}

declare global {
  interface HTMLElementTagNameMap {
    'gene-viewer-custom': GeneViewerCustom;
  }
}
