import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import type { CanvasToolModule } from 'features/controlLayers/konva/CanvasTool/CanvasToolModule';
import { getPrefixedId } from 'features/controlLayers/konva/util';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { createRoot } from 'react-dom/client';
import type { Logger } from 'roarr';

import TextToolbar from './CanvasTextToolbar';

export class CanvasTextToolModule extends CanvasModuleBase {
  readonly type = 'text';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasToolModule;
  readonly log: Logger;
  readonly manager: CanvasManager;

  konva: { layer: Konva.Layer };
  private selectedTextElement: Konva.Text | null = null;
  private transformer: Konva.Transformer;
  private toolbarContainer: HTMLDivElement | null = null;

  constructor(parent: CanvasToolModule) {
    super();
    this.parent = parent;
    this.manager = parent.manager;
    this.id = getPrefixedId(this.type);
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.konva = {
      layer: new Konva.Layer({
        name: `${this.type}:layer`,
        listening: true,
        imageSmoothingEnabled: false,
      }),
    };

    const stage = this.manager.stage.konva.stage;
    if (stage) {
      stage.add(this.konva.layer);
    }

    this.transformer = new Konva.Transformer({
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateEnabled: true,
      boundBoxFunc: (oldBox, newBox) => {
        newBox.width = Math.max(40, newBox.width);
        newBox.height = Math.max(20, newBox.height);
        return newBox;
      },
    });
    this.konva.layer.add(this.transformer);
  }

  onStagePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      if (this.selectedTextElement) {
        this.deselectText();
      }
      return;
    }

    const clickedText = e.target instanceof Konva.Text ? e.target : null;

    if (e.evt.button === 0 && e.evt.shiftKey) {
      this.createTextElement();
      return;
    }

    if (clickedText) {
      this.selectTextElement(clickedText);
    } else if (this.selectedTextElement) {
      this.deselectText();
    }
  };

  deselectText = () => {
    this.selectedTextElement = null;
    this.transformer.nodes([]);
    this.removeToolbar();
  };

  loadFont = async (fontName: string, fontPath: string): Promise<void> => {
    const font = new FontFace(fontName, `url(${fontPath})`);
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);
  };

  createTextElement = async () => {
    const stage = this.manager.stage.konva.stage;
    if (!stage) {
      return;
    }
    const localPos = stage.getRelativePointerPosition();
    if (!localPos) {
      return;
    }

    const fontName = 'CustomFont';
    await this.loadFont(fontName, '/fonts/Roboto-Regular.ttf');

    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const clampedX = Math.max(10, Math.min(stageWidth - 50, localPos.x));
    const clampedY = Math.max(10, Math.min(stageHeight - 50, localPos.y));

    const textElement = new Konva.Text({
      x: clampedX,
      y: clampedY,
      text: 'Double Click to Edit',
      fill: 'rgba(255, 255, 255, 1)',
      fontFamily: fontName,
      fontSize: 24,
      draggable: true,
      fontStyle: 'normal',
      align: 'center',
      visible: true,
      opacity: 1,
    });

    textElement.on('click', () => this.selectTextElement(textElement));
    textElement.on('dblclick', () => this.startEditingText(textElement));

    this.konva.layer.add(textElement);
    if (textElement.getParent()) {
      textElement.moveToTop();
    }
    textElement.opacity(1);
    textElement.visible(true);

    stage.draw();

    this.selectTextElement(textElement);
  };

  selectTextElement = (textElement: Konva.Text) => {
    this.selectedTextElement = textElement;
    if (textElement.getParent()) {
      this.transformer.nodes([textElement]);
    }

    textElement.off('dblclick');
    textElement.on('dblclick', () => this.startEditingText(textElement));

    this.showTextToolbar(textElement);
  };

  startEditingText = (textElement: Konva.Text) => {
    const stage = this.manager.stage.konva.stage;
    if (!stage) {
      return;
    }
    const textPosition = textElement.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    if (document.getElementById('text-editor')) {
      return;
    }

    textElement.visible(false);
    stage.draw();

    const editor = document.createElement('div');
    editor.id = 'text-editor';
    editor.contentEditable = 'true';
    editor.textContent = textElement.text();

    Object.assign(editor.style, {
      position: 'absolute',
      top: `${stageBox.top + textPosition.y}px`,
      left: `${stageBox.left + textPosition.x}px`,
      width: `${textElement.width() + 20}px`,
      minHeight: `${textElement.height()}px`,
      fontFamily: textElement.fontFamily(),
      fontSize: `${textElement.fontSize()}px`,
      color: textElement.fill() as string,
      background: 'rgba(255, 255, 255, 0.8)',
      padding: '5px',
      outline: 'none',
      whiteSpace: 'pre-wrap',
      zIndex: '1000',
    });

    document.body.appendChild(editor);
    editor.focus();

    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.saveTextChanges(textElement, editor);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (editor.parentElement) {
          document.body.removeChild(editor);
        }
        textElement.visible(true);
        stage.draw();
      } else if (event.key === ' ') {
        event.preventDefault();
        document.execCommand('insertText', false, ' ');
      }
    });

    editor.addEventListener('blur', () => {
      this.saveTextChanges(textElement, editor);
    });
  };

  saveTextChanges = (textElement: Konva.Text, editor: HTMLElement) => {
    textElement.text(editor.innerText);
    if (editor.parentElement) {
      document.body.removeChild(editor);
    }
    textElement.visible(true);
    this.manager.stage.konva.stage.draw();
  };

  showTextToolbar = (textElement: Konva.Text) => {
    this.removeToolbar();

    this.toolbarContainer = document.createElement('div');
    this.toolbarContainer.id = 'text-editor-toolbar';
    this.toolbarContainer.style.position = 'absolute';
    this.toolbarContainer.style.zIndex = '900';

    const stage = this.manager.stage.konva.stage;
    const textPosition = textElement.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    const toolbarOffset = 50;
    const toolbarTop = stageBox.top + textPosition.y - toolbarOffset;
    const toolbarLeft = stageBox.left + textPosition.x;
    this.toolbarContainer.style.top = `${toolbarTop}px`;
    this.toolbarContainer.style.left = `${toolbarLeft}px`;

    document.body.appendChild(this.toolbarContainer);

    createRoot(this.toolbarContainer).render(
      <TextToolbar
        onChange={this.handleToolbarChange}
        onClose={this.removeToolbar}
        onDelete={this.handleDelete}
        textProperties={{
          color: textElement.fill() as string,
          fontStyle: textElement.fontStyle() || 'normal',
          fontFamily: textElement.fontFamily() || 'Arial',
          fontSize: textElement.fontSize(),
        }}
      />
    );
  };

  handleToolbarChange = (changes: { color?: string; fontStyle?: string; fontFamily?: string }) => {
    const selectedText = this.selectedTextElement;
    if (!selectedText) {
      return;
    }

    let needsUpdate = false;

    if (changes.color) {
      selectedText.fill(changes.color);
      needsUpdate = true;
    }
    if (changes.fontFamily) {
      selectedText.fontFamily(changes.fontFamily);
      needsUpdate = true;
    }
    if (changes.fontStyle) {
      selectedText.fontStyle(changes.fontStyle);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.transformer.nodes([selectedText]);
    }

    selectedText.getLayer()?.batchDraw();
    this.manager.stage.konva.stage.draw();
  };

  handleDelete = () => {
    if (this.selectedTextElement) {
      this.selectedTextElement.remove();
    }
    this.deselectText();
    this.manager.stage.konva.stage.draw();
  };

  removeToolbar = () => {
    if (this.toolbarContainer) {
      this.toolbarContainer.remove();
      this.toolbarContainer = null;
    }
  };
}
