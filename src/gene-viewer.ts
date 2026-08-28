import { GeneViewer, GeneViewerCustom } from './GeneViewer.js';
import { GeneListAutocomplete } from './GeneListAutocomplete.js';

if (!customElements.get('gene-viewer')) {
  customElements.define('gene-viewer', GeneViewer);
}

if (!customElements.get('gene-viewer-custom')) {
  customElements.define('gene-viewer-custom', GeneViewerCustom);
}

if (!customElements.get('gene-list-autocomplete')) {
  customElements.define('gene-list-autocomplete', GeneListAutocomplete);
}
