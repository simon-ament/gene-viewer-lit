import { html, css, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

export class GeneListAutocomplete extends LitElement {

    /* Styles */

    static styles = css`
        .autocomplete-wrapper {
            position: relative;
            display: inline-block;
            width: 25ch;
        }

        .autocomplete-input {
            padding: var(--input-padding, 0.5rem);
            box-sizing: border-box;
            background-color: var(--background-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5em;
            color: inherit;
            width: 100%;
            font-size: var(--input-font-size, 1rem);
        }

        .autocomplete-list {
            position: absolute;
            background-color: var(--background-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5em;
            max-height: 15rem;
            overflow-y: auto;
            padding: 0;
            margin: 0;
            margin-top: 1px;
            width: 100%;
        }
        .autocomplete-item {
            font-size: 1.4em;
            cursor: pointer;
            list-style-type: none;
            padding: var(--input-padding, 0.5rem);
        }
        .autocomplete-item:not(.disabled):hover {
            background-color: color(from contrast-color(var(--background-color)) srgb r g b / 0.05);
        }
        .autocomplete-item.highlighted {
            background-color: color(from contrast-color(var(--background-color)) srgb r g b / 0.1);
        }
        .autocomplete-item.disabled {
            opacity: 0.5;
            cursor: default;
        }
    `;

    /* Properties */

    @property({ type: Array }) geneList: string[] = [];

    @property({ type: String }) selectedGene: string | null = null;
    
    /* State */

    @state()
    protected _filteredGeneList: string[] = [];

    @state()
    protected _isGeneListOverflowing: boolean = false;

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
            this._isGeneListOverflowing = false;
            return;
        }
        const lowerCaseInput = this._inputValue.toLowerCase();
        const filtered = this.geneList.filter(geneId => geneId.toLowerCase().includes(lowerCaseInput));
        this._isGeneListOverflowing = filtered.length > 100;
        this._filteredGeneList = filtered.slice(0, 100); // limit to 100 results
    }

    protected _onGeneSelect(geneId: string) {
        this._inputValue = geneId;
        this._filteredGeneList = [];
        this._isGeneListOverflowing = false;
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
                this._highlightedIndex = -1;
                this._isGeneListOverflowing = false;
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
                this._isGeneListOverflowing = false;
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
                    ${(this._isGeneListOverflowing) ? html`<li class="autocomplete-item disabled">More results available. Please refine your search.</li>` : ''}
                </ul>
            </div>
        `;
    }
}
