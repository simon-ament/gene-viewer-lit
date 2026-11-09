// Registers all gene-viewer custom elements. Each module guards its own
// `customElements.define` call, so importing this module more than once
// (e.g. from separate bundles) does not throw.
import './GeneViewer.js';
import './GeneViewerCustom.js';
import './GeneListAutocomplete.js';
