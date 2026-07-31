import { html } from 'lit';
import { fixture, expect } from '@open-wc/testing';
import { GeneViewer } from '../src/GeneViewer.js';
import '../src/gene-viewer.js';

describe('GeneViewer', () => {
  // it('has a default header "Hey there" and counter 5', async () => {
  //   const el = await fixture<GeneViewer>(html`<gene-viewer></gene-viewer>`);

  //   expect(el.header).to.equal('Hey there');
  //   expect(el.counter).to.equal(5);
  // });

  // it('increases the counter on button click', async () => {
  //   const el = await fixture<GeneViewer>(html`<gene-viewer></gene-viewer>`);
  //   el.shadowRoot!.querySelector('button')!.click();

  //   expect(el.counter).to.equal(6);
  // });

  // it('can override the header via attribute', async () => {
  //   const el = await fixture<GeneViewer>(html`<gene-viewer header="attribute header"></gene-viewer>`);

  //   expect(el.header).to.equal('attribute header');
  // });

  // it('passes the a11y audit', async () => {
  //   const el = await fixture<GeneViewer>(html`<gene-viewer></gene-viewer>`);

  //   await expect(el).shadowDom.to.be.accessible();
  // });
});
