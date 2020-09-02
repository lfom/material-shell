/** Gnome libs imports */
const { St, GObject, Clutter, Gio } = imports.gi;
const Main = imports.ui.main;

/** Extension imports */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { MsStatusArea } = Me.imports.src.layout.panel.statusArea;
const { MatPanelButton } = Me.imports.src.layout.panel.panelButton;
const { WorkspaceList } = Me.imports.src.layout.panel.workspaceList;

/* exported MsPanel */
var MsPanel = GObject.registerClass(
    {
        GTypeName: 'MsPanel',
    },
    class MsPanel extends St.BoxLayout {
        _init() {
            super._init({
                name: 'msPanel',
                vertical: true,
                y_align: Clutter.ActorAlign.START,
            });
            this.gnomeShellPanel = Main.panel;
            this.gnomeShellPanel.hide();

            // Top part
            this.topBox = new St.BoxLayout({
                vertical: true,
                y_expand: true,
            });
            this.add_child(this.topBox);

            this.searchIcon = new St.Icon({
                gicon: Gio.icon_new_for_string(
                    `${Me.path}/assets/icons/magnify-symbolic.svg`
                ),
                style_class: 'mat-panel-button-icon',
                icon_size: Me.msThemeManager.getPanelSizeNotScaled() / 2,
            });

            this.searchButton = new MatPanelButton({
                child: this.searchIcon,
                primary: true,
            });

            this.searchButton.connect('clicked', () => {
                if (!Main.overview._shown) {
                    Main.overview.show();
                } else {
                    Main.overview.hide();
                }
            });

            this.topBox.add_child(this.searchButton);

            this.workspaceList = new WorkspaceList();
            this.topBox.add_child(this.workspaceList);

            //Bottom part
            this.statusArea = new MsStatusArea();
            this.add_child(this.statusArea);
            this.disableConnect = Me.connect('extension-disable', () => {
                Me.disconnect(this.disableConnect);
                this.gnomeShellPanel.show();
            });

            Me.msThemeManager.connect('panel-size-changed', () => {
                this.searchIcon.set_icon_size(
                    Me.msThemeManager.getPanelSizeNotScaled() / 2
                );
                this.queue_relayout();
            });
        }

        vfunc_get_preferred_width(_forHeight) {
            return [
                Me.msThemeManager.getPanelSize(Main.layoutManager.primaryIndex),
                Me.msThemeManager.getPanelSize(Main.layoutManager.primaryIndex),
            ];
        }

        vfunc_get_preferred_height(_forWidth) {
            return [
                Main.layoutManager.primaryMonitor.height,
                Main.layoutManager.primaryMonitor.height,
            ];
        }
    }
);
