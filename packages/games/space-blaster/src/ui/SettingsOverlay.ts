import type * as Phaser from 'phaser';

type SettingsOverlayOptions = {
  scene: Phaser.Scene;
  getMusicVolume: () => number;
  getSfxVolume: () => number;
  onMusicVolumeChanged: (value: number) => void;
  onSfxVolumeChanged: (value: number) => void;
  onResumeRequested: () => void;
};

type SliderUi = {
  label: Phaser.GameObjects.Text;
  valueText: Phaser.GameObjects.Text;
  track: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  knob: Phaser.GameObjects.Arc;
  getValue: () => number;
  setValue: (value: number) => void;
  onPointer: (worldX: number) => void;
};

const OVERLAY_BG_ALPHA = 0.62;
const PANEL_COLOR = 0x12182a;
const PANEL_STROKE = 0x6ad7ff;
const TRACK_COLOR = 0x1f2f44;
const FILL_COLOR = 0x7de1ff;
const KNOB_COLOR = 0xf9d65c;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export class SettingsOverlay {
  private readonly scene: Phaser.Scene;
  private readonly getMusicVolume: () => number;
  private readonly getSfxVolume: () => number;
  private readonly onMusicVolumeChanged: (value: number) => void;
  private readonly onSfxVolumeChanged: (value: number) => void;
  private readonly onResumeRequested: () => void;

  private root?: Phaser.GameObjects.Container;
  private overlayBg?: Phaser.GameObjects.Rectangle;
  private pauseMenuContainer?: Phaser.GameObjects.Container;
  private settingsContainer?: Phaser.GameObjects.Container;
  private titleText?: Phaser.GameObjects.Text;
  private draggingSlider: 'music' | 'sfx' | null = null;

  private musicSlider?: SliderUi;
  private sfxSlider?: SliderUi;
  private onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUp?: () => void;

  constructor(options: SettingsOverlayOptions) {
    this.scene = options.scene;
    this.getMusicVolume = options.getMusicVolume;
    this.getSfxVolume = options.getSfxVolume;
    this.onMusicVolumeChanged = options.onMusicVolumeChanged;
    this.onSfxVolumeChanged = options.onSfxVolumeChanged;
    this.onResumeRequested = options.onResumeRequested;
  }

  create(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.overlayBg = this.scene.add
      .rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x05070d,
        OVERLAY_BG_ALPHA,
      )
      .setScrollFactor(0)
      .setInteractive();

    this.root = this.scene.add.container(0, 0);
    this.root.setDepth(3000);

    const panel = this.scene.add.rectangle(
      width / 2,
      height / 2,
      420,
      280,
      PANEL_COLOR,
      0.95,
    );
    panel.setStrokeStyle(2, PANEL_STROKE, 0.4);

    this.titleText = this.scene.add
      .text(width / 2, height / 2 - 110, 'Paused', {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '26px',
        color: '#f3f7ff',
      })
      .setOrigin(0.5);

    this.pauseMenuContainer = this.scene.add.container(width / 2, height / 2);
    const resumeBtn = this.createButton(0, -16, 'Resume');
    const settingsBtn = this.createButton(0, 44, 'Settings');
    resumeBtn.on('pointerup', () => this.onResumeRequested());
    settingsBtn.on('pointerup', () => this.showSettings());
    this.pauseMenuContainer.add([resumeBtn]);
    this.pauseMenuContainer.add([settingsBtn]);

    this.settingsContainer = this.scene.add.container(width / 2, height / 2);
    this.settingsContainer.setVisible(false);

    this.musicSlider = this.createSlider({
      x: -150,
      y: -34,
      label: 'Music Volume',
      initialValue: this.getMusicVolume(),
      onChanged: (value) => this.onMusicVolumeChanged(value),
      key: 'music',
    });
    this.sfxSlider = this.createSlider({
      x: -150,
      y: 40,
      label: 'SFX Volume',
      initialValue: this.getSfxVolume(),
      onChanged: (value) => this.onSfxVolumeChanged(value),
      key: 'sfx',
    });

    const closeBtn = this.createButton(0, 104, 'Back');
    closeBtn.on('pointerup', () => this.showPauseMenu());

    this.settingsContainer.add([
      this.musicSlider.label,
      this.musicSlider.valueText,
      this.musicSlider.track,
      this.musicSlider.fill,
      this.musicSlider.knob,
      this.sfxSlider.label,
      this.sfxSlider.valueText,
      this.sfxSlider.track,
      this.sfxSlider.fill,
      this.sfxSlider.knob,
      closeBtn,
    ]);

    this.root.add([
      this.overlayBg,
      panel,
      this.titleText,
      this.pauseMenuContainer,
      this.settingsContainer,
    ]);
    this.root.setVisible(false);

    this.onPointerMove = (pointer) => {
      if (!this.draggingSlider) return;
      if (this.draggingSlider === 'music') {
        this.updateSliderFromPointer(this.musicSlider, pointer.worldX);
      } else {
        this.updateSliderFromPointer(this.sfxSlider, pointer.worldX);
      }
    };
    this.onPointerUp = () => {
      this.draggingSlider = null;
    };

    this.scene.input.on('pointermove', this.onPointerMove);
    this.scene.input.on('pointerup', this.onPointerUp);
  }

  showPauseMenu(): void {
    this.root?.setVisible(true);
    this.pauseMenuContainer?.setVisible(true);
    this.settingsContainer?.setVisible(false);
    if (this.titleText) {
      this.titleText.setText('Paused');
    }
  }

  showSettings(): void {
    this.root?.setVisible(true);
    this.pauseMenuContainer?.setVisible(false);
    this.settingsContainer?.setVisible(true);
    if (this.titleText) {
      this.titleText.setText('Settings');
    }
    this.musicSlider?.setValue(this.getMusicVolume());
    this.sfxSlider?.setValue(this.getSfxVolume());
  }

  hideAll(): void {
    this.root?.setVisible(false);
    this.draggingSlider = null;
  }

  isPauseMenuVisible(): boolean {
    return Boolean(this.root?.visible && this.pauseMenuContainer?.visible);
  }

  isSettingsVisible(): boolean {
    return Boolean(this.root?.visible && this.settingsContainer?.visible);
  }

  handleEscape(): boolean {
    if (this.isSettingsVisible()) {
      this.showPauseMenu();
      return true;
    }
    if (this.isPauseMenuVisible()) {
      this.hideAll();
      return true;
    }
    return false;
  }

  destroy(): void {
    if (this.onPointerMove) {
      this.scene.input.off('pointermove', this.onPointerMove);
      this.onPointerMove = undefined;
    }
    if (this.onPointerUp) {
      this.scene.input.off('pointerup', this.onPointerUp);
      this.onPointerUp = undefined;
    }

    this.root?.destroy(true);
    this.root = undefined;
    this.pauseMenuContainer = undefined;
    this.settingsContainer = undefined;
    this.overlayBg = undefined;
    this.titleText = undefined;
    this.musicSlider = undefined;
    this.sfxSlider = undefined;
    this.draggingSlider = null;
  }

  private createButton(
    x: number,
    y: number,
    label: string,
  ): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, label, {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '20px',
        color: '#101628',
        backgroundColor: '#f9d65c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
  }

  private createSlider(args: {
    x: number;
    y: number;
    label: string;
    initialValue: number;
    onChanged: (value: number) => void;
    key: 'music' | 'sfx';
  }): SliderUi {
    const trackWidth = 300;
    const trackHeight = 12;
    const fillHeight = 12;
    const label = this.scene.add
      .text(args.x, args.y - 24, args.label, {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '15px',
        color: '#d5d8e0',
      })
      .setOrigin(0, 0.5);
    const valueText = this.scene.add
      .text(args.x + trackWidth, args.y - 24, '0%', {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '14px',
        color: '#7de1ff',
      })
      .setOrigin(1, 0.5);
    const track = this.scene.add
      .rectangle(
        args.x + trackWidth / 2,
        args.y,
        trackWidth,
        trackHeight,
        TRACK_COLOR,
        1,
      )
      .setOrigin(0.5)
      .setInteractive();
    const fill = this.scene.add
      .rectangle(args.x, args.y, trackWidth, fillHeight, FILL_COLOR, 1)
      .setOrigin(0, 0.5);
    const knob = this.scene.add
      .circle(args.x, args.y, 10, KNOB_COLOR)
      .setOrigin(0.5)
      .setInteractive({ draggable: true, useHandCursor: true });

    const setValue = (value: number) => {
      const normalized = clamp01(value);
      const fillWidth = trackWidth * normalized;
      fill.width = fillWidth;
      knob.setPosition(args.x + fillWidth, args.y);
      valueText.setText(`${Math.round(normalized * 100)}%`);
    };

    const getValue = () => (knob.x - args.x) / trackWidth;

    const applyFromPointerX = (worldX: number) => {
      const bounds = track.getBounds();
      const normalized = clamp01((worldX - bounds.x) / bounds.width);
      setValue(normalized);
      args.onChanged(normalized);
    };

    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.draggingSlider = args.key;
      applyFromPointerX(pointer.worldX);
    });

    knob.on('pointerdown', () => {
      this.draggingSlider = args.key;
    });

    setValue(args.initialValue);

    return {
      label,
      valueText,
      track,
      fill,
      knob,
      getValue,
      setValue,
      onPointer: applyFromPointerX,
    };
  }

  private updateSliderFromPointer(
    slider: SliderUi | undefined,
    worldX: number,
  ): void {
    if (!slider) return;
    slider.onPointer(worldX);
  }
}
