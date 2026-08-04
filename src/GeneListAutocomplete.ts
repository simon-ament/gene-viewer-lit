import { html, css, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

export class GeneListAutocomplete extends LitElement {

    /* Styles */

    static styles = css`
        .autocomplete-wrapper {
            position: relative;
            display: inline-block;
            width: 100%;
        }

        .autocomplete-input {
            padding: 0.5rem;
            box-sizing: border-box;
            background-color: var(--gene-viewer-background-color, #fff);
            border: 1px solid var(--gene-viewer-border-color, #888);
            border-radius: 0.3rem;
            color: inherit;
            width: 100%;
        }

        .autocomplete-list {
            position: absolute;
            background-color: var(--gene-viewer-background-color, #fff);
            border: 1px solid var(--gene-viewer-border-color, #888);
            border-radius: 0.3rem;
            max-height: 15rem;
            overflow-y: auto;
            padding: 0;
            margin: 0;
            margin-top: 1px;
            width: 100%;
        }
        .autocomplete-item {
            cursor: pointer;
            list-style-type: none;
            padding: 5px 20px;
        }
        .autocomplete-item:hover {
            background-color: #f0f0f0;
        }
        .autocomplete-item.highlighted {
            background-color: #e0e0e0;
        }
    `;

    /* Properties */

    @property({ type: Array }) geneList: string[] = [];

    @property({ type: String }) selectedGene: string | null = null;
    
    /* State */

    @state()
    protected _filteredGeneList: string[] = [];

    @state()
    protected _inputValue: string = '';

    @state()
    protected _highlightedIndex: number = -1;

    /* Queries */

    @query('input')
    protected _inputElement!: HTMLInputElement;

    @query('.autocomplete-item.highlighted')
    protected _highlightedItem!: HTMLElement;

    /* Methods */

    protected _onInputChange(event: Event) {
        const input = event.target as HTMLInputElement;
        this._inputValue = input.value;
        this._filterGeneList();
        this._highlightedIndex = -1; // reset highlighted index on input change
    }

    protected _filterGeneList() {
        if (this._inputValue.trim() === '') {
            this._filteredGeneList = [];
            return;
        }
        const lowerCaseInput = this._inputValue.toLowerCase();
        this._filteredGeneList = this.geneList
            .filter(geneId => geneId.toLowerCase().includes(lowerCaseInput))
            .slice(0, 100);
    }

    protected _onGeneSelect(geneId: string) {
        this._inputValue = geneId;
        this._filteredGeneList = [];
        this._highlightedIndex = -1;
        const inputElement = this.shadowRoot?.querySelector('input') as HTMLInputElement;
        if (inputElement) {
            inputElement.value = geneId;
        }

        this.dispatchEvent(new CustomEvent('gene-selected', {
            detail: { geneId },
            bubbles: true,
            composed: true
        }));
    }

    /* Lifecycle */

    firstUpdated() {
        this._inputElement.addEventListener('input', this._onInputChange.bind(this));
        this._inputElement.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                if (this._highlightedIndex >= 0 && this._highlightedIndex < this._filteredGeneList.length) {
                    this._onGeneSelect(this._filteredGeneList[this._highlightedIndex]);
                } else if (this._filteredGeneList.includes(this._inputValue)) {
                    this._onGeneSelect(this._inputValue);
                }
            }
            if (event.key === 'Escape') {
                this._filteredGeneList = [];
            }
            if (event.key === 'ArrowDown' && this._filteredGeneList.length > 0) {
                event.preventDefault();
                this._highlightedIndex = Math.min(this._highlightedIndex + 1, this._filteredGeneList.length - 1);
            }
            if (event.key === 'ArrowUp' && this._filteredGeneList.length > 0) {
                event.preventDefault();
                this._highlightedIndex = Math.max(this._highlightedIndex - 1, 0);
            }
        });
        this._inputElement.addEventListener('blur', () => {
            setTimeout(() => {
                this._filteredGeneList = [];
                this._highlightedIndex = -1;
            }, 100);
        })
    }
        

    update(changedProperties: Map<string, any>) {
        super.update(changedProperties);

        if (changedProperties.has('geneList')) {
            this._filterGeneList();
        }

        if (changedProperties.has('selectedGene')) {
            this._inputValue = this.selectedGene || '';
            const inputElement = this.shadowRoot?.querySelector('input') as HTMLInputElement;
            if (inputElement) {
                inputElement.value = this._inputValue;
            }
        }
    }

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        if (changedProperties.has('_highlightedIndex')) {
            // scroll the highlighted item into view
            const highlightedItem = this._highlightedItem;
            if (highlightedItem) {
                highlightedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    /* Render */

    render() {
        return html`
            <div class="autocomplete-wrapper">
                <input class="autocomplete-input" type="text" @input="${this._onInputChange}" placeholder="Type a gene name...">
                <ul class="autocomplete-list" .hidden="${this._filteredGeneList.length === 0}">
                    ${this._filteredGeneList.map(geneId => html`
                        <li 
                            class="autocomplete-item ${this._highlightedIndex === this._filteredGeneList.indexOf(geneId) ? 'highlighted' : ''}" 
                            @click="${() => this._onGeneSelect(geneId)}">${geneId}
                        </li>`
                    )}
                </ul>
            </div>
        `;
    }
}
