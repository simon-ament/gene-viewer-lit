import { customElement } from 'lit/decorators.js';
import { Gene } from './visualization/types.js';
import './GeneListAutocomplete.js';
import { GeneViewerBase } from './GeneViewerBase.js';

@customElement('gene-viewer-custom')
export class GeneViewerCustom extends GeneViewerBase {
  /* Methods */

  public setGene(gene: Gene) {
    super._setGene(gene);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gene-viewer-custom': GeneViewerCustom;
  }
}
