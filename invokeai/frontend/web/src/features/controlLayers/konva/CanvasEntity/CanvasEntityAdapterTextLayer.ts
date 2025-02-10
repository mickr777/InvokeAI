import { createSelector } from '@reduxjs/toolkit';
import { CanvasEntityAdapterBase } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterBase';
import type { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import type { CanvasEntityFilterer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityFilterer';
import type { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import type { CanvasEntityTransformer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityTransformer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import type { CanvasSegmentAnythingModule } from 'features/controlLayers/konva/CanvasSegmentAnythingModule';
import {
  buildSelectIsSelected,
  getSelectIsTypeHidden,
  selectCanvasSlice,
  selectEntity,
} from 'features/controlLayers/store/selectors';
import Konva from 'konva';
import { assert } from 'tsafe';
import type { JsonObject } from 'type-fest';

export interface CanvasEntityCommonState {
  id: string;
  name: string | null;
  isEnabled: boolean;
  isLocked: boolean;
  position: { x: number; y: number };
  opacity: number;
}

export interface RgbaColor extends JsonObject {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const rgbaToCssString = (rgba: RgbaColor): string => `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;

export interface CanvasTextLayerState extends CanvasEntityCommonState {
  type: 'text_layer';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: string;
  fill: RgbaColor;
}

export class CanvasEntityAdapterTextLayer extends CanvasEntityAdapterBase<CanvasTextLayerState, 'text_layer'> {
  transformer: CanvasEntityTransformer;
  renderer: CanvasEntityObjectRenderer;
  bufferRenderer: CanvasEntityBufferObjectRenderer;
  filterer?: CanvasEntityFilterer;
  segmentAnything?: CanvasSegmentAnythingModule;

  constructor(entityIdentifier: { id: string; type: 'text_layer' }, manager: CanvasManager) {
    super(entityIdentifier, manager, 'text_layer');

    const state = this.manager.stateApi.runSelector(this.selectState);
    assert(state !== undefined, 'Missing entity state on creation');
    this.state = state as CanvasTextLayerState;

    this.selectIsTypeHidden = getSelectIsTypeHidden(this.entityIdentifier.type);
    this.selectIsSelected = buildSelectIsSelected(this.entityIdentifier);

    this.konva = {
      layer: new Konva.Layer({
        name: `text_layer:layer`,
        listening: false,
        imageSmoothingEnabled: false,
      }),
    };
    this.manager.stage.addLayer(this.konva.layer);

    this.transformer = {
      $pixelRect: { get: () => ({ x: 0, y: 0, width: 100, height: 50 }), listen: () => {} },
      initialize: () => {},
      updatePosition: () => {},
      syncInteractionState: () => {},
      requestRectCalculation: () => {},
    } as any;

    this.renderer = {
      konva: { objectGroup: new Konva.Group() },
      initialize: async () => {},
      render: async () => true,
      updateOpacity: () => {},
      updateCompositingRectSize: () => {},
      updateCompositingRectPosition: () => {},
      updateCompositingRectFill: () => {},
      syncKonvaCache: () => {},
      destroy: () => {},
      repr: () => ({}),
    } as any;

    this.bufferRenderer = {
      konva: { group: new Konva.Group() },
      initialize: async () => {},
      repr: () => ({}),
    } as any;
  }

  selectState = createSelector(
    selectCanvasSlice,
    (canvas) => selectEntity(canvas, this.entityIdentifier) as CanvasTextLayerState | undefined
  );

  selectPosition = createSelector(this.selectState, (entity) => entity?.position);

  sync = async (
    state: CanvasTextLayerState | undefined,
    prevState: CanvasTextLayerState | undefined
  ): Promise<void> => {
    if (!state) {
      return;
    }
    console.log('Syncing text layer state:', state);
  };

  getCanvas = (rect?: { x: number; y: number; width: number; height: number }): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = rect?.width ?? 200;
    canvas.height = rect?.height ?? 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = rgbaToCssString(this.state.fill);
      ctx.font = `${this.state.fontStyle} ${this.state.fontSize}px ${this.state.fontFamily}`;
      ctx.fillText(this.state.text, 0, this.state.fontSize);
    }
    return canvas;
  };

  getHashableState = (): JsonObject => {
    const { text, fontFamily, fontSize, fontStyle, fill } = this.state;
    return { text, fontFamily, fontSize, fontStyle, fill };
  };
}
