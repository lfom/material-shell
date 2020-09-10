/** Gnome libs imports */
const { GObject, St, Clutter, Gio } = imports.gi;
const Main = imports.ui.main;

/** Extension imports */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { SetAllocation, Allocate } = Me.imports.src.utils.compatibility;
const { MatPanelButton } = Me.imports.src.layout.panel.panelButton;
const { TaskBar, TaskBarItem } = Me.imports.src.widget.taskBar;

/* exported TopPanel */
var TopPanel = GObject.registerClass(
    class TopPanel extends St.BoxLayout {
        _init(msWorkspace) {
            super._init({
                name: 'topPanel',
            });
            this._delegate = this;
            this.msWorkspace = msWorkspace;

            this.taskBar = new TaskBar(msWorkspace);

            // this.searchIcon = new St.Icon({
            //     gicon: Gio.icon_new_for_string(
            //         `${Me.path}/assets/icons/magnify-symbolic.svg`
            //     ),
            //     style_class: 'mat-panel-button-icon',
            //     icon_size: Me.msThemeManager.getPanelSizeNotScaled() / 2,
            // });

            // this.searchButton = new MatPanelButton({
            //     child: this.searchIcon,
            //     primary: true,
            //     can_focus: true,
            //     track_hover: true,
            // });

            // this.searchButton.connect('clicked', () => {
            //     (Main.overview._shown) ? Main.overview.hide() : Main.overview.show();
            // });

            // this.add_child(this.searchButton);

            this.tilingIcon = new St.Icon({
                style_class: 'mat-panel-button-icon',
                icon_size: Me.msThemeManager.getPanelSizeNotScaled() / 2,
            });

            this.tilingButton = new MatPanelButton({
                child: this.tilingIcon,
                style_class: 'mat-panel-button',
                can_focus: true,
                track_hover: true,
            });

            this.tilingButton.connect('clicked', (actor, button) => {
                // Go in reverse direction on right click (button: 3)
                msWorkspace.nextTiling(button === 3 ? -1 : 1);
            });

            this.add_child(this.taskBar);
            this.add_child(this.tilingButton);

            Me.msThemeManager.connect('panel-size-changed', () => {
                this.tilingIcon.set_icon_size(
                    Me.msThemeManager.getPanelSizeNotScaled() / 2
                );
                // this.searchIcon.set_icon_size(
                //     Me.msThemeManager.getPanelSizeNotScaled() / 2
                // );
                this.queue_relayout();
            });
        }

        handleDragOver(source) {
            if (source instanceof TaskBarItem) {
                return this.taskBar.updateCurrentTaskBar();
            }
            return DND.DragMotionResult.NO_DROP;
        }

        acceptDrop(source) {
            if (source instanceof TaskBarItem) {
                this.taskBar.reparentDragItem();
                return true;
            }
            return false;
        }

        vfunc_get_preferred_height(_forWidth) {
            let height = Me.msThemeManager.getPanelSize(
                this.msWorkspace.monitor.index
            );
            return [height, height];
        }

        vfunc_allocate(box, flags) {
            SetAllocation(this, box, flags);
            let themeNode = this.get_theme_node();
            const contentBox = themeNode.get_content_box(box);

            // let searchButtonBox = new Clutter.ActorBox();
            // searchButtonBox.x1 = contentBox.x1;
            // searchButtonBox.x2 = Math.max(
            //     this.searchButton.width,
            //     0
            // );
            // searchButtonBox.y1 = contentBox.y1;
            // searchButtonBox.y2 = contentBox.y2;
            // this.searchButton.allocate(searchButtonBox, flags);

            let taskBarBox = new Clutter.ActorBox();
            taskBarBox.x1 = contentBox.x1;
            taskBarBox.x2 = Math.max(
                contentBox.x2 - this.tilingButton.width,
                0
            );
            taskBarBox.y1 = contentBox.y1;
            taskBarBox.y2 = contentBox.y2;
            Allocate(this.taskBar, taskBarBox, flags);

            let tilingButtonBox = new Clutter.ActorBox();
            tilingButtonBox.x1 = taskBarBox.x2;
            tilingButtonBox.x2 = contentBox.x2;
            tilingButtonBox.y1 = contentBox.y1;
            tilingButtonBox.y2 = contentBox.y2;
            Allocate(this.tilingButton, tilingButtonBox, flags);
        }
    }
);
