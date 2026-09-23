import { VisualizationContext } from './index.js';

/**
 * Updates the position of the location indicator and its label.
 *
 * @param context The visualization context object.
 * @param xPos The x position (in pixels) where the location indicator should be updated to.
 */
export const updateLocationIndicator = (
  context: VisualizationContext,
  xPos?: number,
) => {
  if (xPos) {
    context.locationIndicatorPosition = xPos; // store last known position
  }
  const zx = context.currentZoomTransform.rescaleX(context.xScale);
  const domainX = zx.invert(xPos || context.locationIndicatorPosition);
  const snapX = Math.floor(domainX + 0.5);
  const x = zx(snapX - 0.5);

  context.locationIndicator.attr('x', x);
  context.positionLabelGroup
    .select('text')
    .attr('x', x + 1.3 * (zx(1) - zx(0))) // add some padding from the indicator
    .text(snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')); // insert commas for thousands

  const positionLabelNode = context.positionLabelGroup
    .select('text')
    .node() as SVGTextElement;
  if (!positionLabelNode) {
    return;
  }

  const { x: labelX, y: labelY, width, height } = positionLabelNode.getBBox();
  const paddingRight = 4;
  const paddingLeft = 2;
  const paddingY = 5;
  context.positionLabelGroup
    .select('rect')
    .attr('x', labelX - paddingLeft)
    .attr('y', labelY - paddingY)
    .attr('width', width + paddingLeft + paddingRight)
    .attr('height', height + paddingY * 2);
};
