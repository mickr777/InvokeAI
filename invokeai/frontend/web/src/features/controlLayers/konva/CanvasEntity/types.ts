import type { CanvasEntityAdapterControlLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterControlLayer';
import type { CanvasEntityAdapterInpaintMask } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterInpaintMask';
import type { CanvasEntityAdapterRasterLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterRasterLayer';
import type { CanvasEntityAdapterRegionalGuidance } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterRegionalGuidance';
import type { CanvasEntityAdapterTextLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterTextLayer';
import type { CanvasRenderableEntityType } from 'features/controlLayers/store/types';

export type CanvasEntityAdapter =
  | CanvasEntityAdapterRasterLayer
  | CanvasEntityAdapterControlLayer
  | CanvasEntityAdapterInpaintMask
  | CanvasEntityAdapterRegionalGuidance
  | CanvasEntityAdapterTextLayer;

export type CanvasEntityAdapterFromType<T extends CanvasRenderableEntityType> = Extract<
  CanvasEntityAdapter,
  { state: { type: T } }
>;
