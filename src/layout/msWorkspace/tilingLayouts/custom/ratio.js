/** Gnome libs imports */
const { GObject } = imports.gi;

/** Extension imports */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const {
    BaseTilingLayout,
} = Me.imports.src.layout.msWorkspace.tilingLayouts.baseTiling;
const { getSettings } = Me.imports.src.utils.settings;

/* exported RatioLayout */
var RatioLayout = GObject.registerClass(
    class RatioLayout extends BaseTilingLayout {
        tileTileable(tileable, box, index, siblingLength) {
            // Define tileable.x tileable.y tileable.width tileable.height
            let { x, y, width, height } = this.tile(
                box,
                index,
                index === siblingLength - 1
            );
            ({ x, y, width, height } = this.applyGaps(x, y, width, height));
            tileable.x = x;
            tileable.y = y;
            tileable.width = width;
            tileable.height = height;
            this.ratio = Me.tilingManager.ratio;
            this.layoutsSettings = getSettings('layouts');
        }

        tile(box, index, last) {
            let ratio = this.ratio;
            let areaBox = {
                x: box.x1,
                y: box.y1,
                width: box.get_width(),
                height: box.get_height(),
            };
            return new Array(index + 1).fill().reduce((area, _, i) => {
                // If it's the last iteration
                if (index === i) {
                    // If it's the last window, it takes all the remaining space
                    if (last) {
                        return area;
                    }
                    // Otherwise it's a simple split from available space
                    if (area.width > area.height) {
                        return {
                            x: area.x,
                            y: area.y,
                            width: area.width * ratio,
                            height: area.height,
                        };
                    }
                    return {
                        x: area.x,
                        y: area.y,
                        width: area.width,
                        height: area.height * ratio,
                    };
                }
                // If it's a normal iteration compute remaining space atfer split
                if (area.width > area.height) {
                    return {
                        x: area.x + area.width * ratio,
                        y: area.y,
                        width: area.width * (1 - ratio),
                        height: area.height,
                    };
                }
                return {
                    x: area.x,
                    y: area.y + area.height * ratio,
                    width: area.width,
                    height: area.height * (1 - ratio),
                };
            }, areaBox);
        }

        onCustomizingHotkeyDecrease() {
            if (this.ratio < 0.2) return;
            this.ratio = Math.max(0, this.ratio - 0.05);
            this.layoutsSettings.set_double('ratio-value', this.ratio);
            this.tileAll();
            this.layout_changed();
        }

        onCustomizingHotkeyIncrease() {
            if (this.ratio > 0.8) return;
            this.ratio = Math.min(1, this.ratio + 0.05);
            this.layoutsSettings.set_double('ratio-value', this.ratio);
            this.tileAll();
            this.layout_changed();
        }
    }
);

RatioLayout.key = 'ratio';
