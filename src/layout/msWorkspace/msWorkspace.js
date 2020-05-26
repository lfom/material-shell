const { Clutter, GLib, St, Shell, GObject } = imports.gi;
const Signals = imports.signals;
const Main = imports.ui.main;
const Background = imports.ui.background;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const {
    MaximizeLayout,
} = Me.imports.src.layout.msWorkspace.tilingLayouts.maximize;
const { MsWindow } = Me.imports.src.layout.msWorkspace.msWindow;

const TopPanel = Me.imports.src.widget.topPanelWidget.TopPanel;
const { debounce } = Me.imports.src.utils.index;
const WindowUtils = Me.imports.src.utils.windows;

const { MsApplicationLauncher } = Me.imports.src.widget.msApplicationLauncher;

const EMIT_DEBOUNCE_DELAY = 100;
const { AddLogToFunctions, log, logFocus } = Me.imports.src.utils.debug;
const { reparentActor } = Me.imports.src.utils.index;

var MsWorkspace = class MsWorkspace {
    constructor(msWorkspaceManager, monitor, initialState) {
        AddLogToFunctions(this);
        this.msWorkspaceManager = msWorkspaceManager;
        this.monitor = monitor;
        this.monitorIsPrimary =
            monitor.index === Main.layoutManager.primaryIndex;
        this.tileableList = [];
        this.uiVisible = true;
        this.focusedIndex = 0;

        this.appLauncher = new MsApplicationLauncher(this);
        //this.appLauncher = new Clutter.Actor();

        this.tileableList.push(this.appLauncher);
        this.msWorkspaceActor = new MsWorkspaceActor(this);
        const Layout = Me.tilingManager.getLayoutByKey(
            initialState ? initialState.tilingLayout : 'maximized'
        );
        this.tilingLayout = new Layout(this);
        this.msWorkspaceActor.tileableContainer.set_layout_manager(
            this.tilingLayout
        );
        this.msWorkspaceActor.panel.tilingIcon.gicon = this.tilingLayout.icon;

        if (initialState) {
            log(
                'IN MSWORKSPACE CREATION',
                initialState,
                initialState.msWindowList.length
            );
            initialState.msWindowList.forEach((msWindowData) => {
                this.addMsWindow(
                    Me.msWindowManager.createNewMsWindow(
                        msWindowData.appId,
                        msWindowData.metaWindowIdentifier
                    )
                );
            });
        }
    }

    destroy() {
        log('destroy msWorkspace');
        this.tilingLayout.onDestroy();
        if (this.msWorkspaceActor) {
            this.msWorkspaceActor.destroy();
            delete this.msWorkspaceActor;
        }
        this.destroyed = true;
    }

    get tileableFocused() {
        if (!this.tileableList) return null;
        return this.tileableList[this.focusedIndex];
    }

    get msWindowList() {
        return Me.msWindowManager.msWindowList.filter((msWindow) => {
            return msWindow.msWorkspace && msWindow.msWorkspace === this;
        });
    }

    updateUI() {
        if (this.msWorkspaceActor) {
            //this.msWorkspaceActor.visible = this.uiVisible;
        }
        if (this.msWorkspaceActor.panel) {
            this.msWorkspaceActor.panel.visible = this.shouldPanelBeVisible();
        }
    }

    close() {
        Promise.all(
            this.msWindowList.map((msWindow) => {
                return msWindow.kill();
            })
        ).then((params) => {
            this.emit('readyToBeClosed');
        });
    }

    async addMsWindow(msWindow) {
        logFocus('addMsWindow');
        if (!msWindow) return;
        if (msWindow.msWorkspace === this) return;

        msWindow.msWorkspace = this;
        if (msWindow.metaWindow) {
            WindowUtils.updateTitleBarVisibility(msWindow.metaWindow);
        }

        if (!msWindow.dragged) {
            reparentActor(msWindow, this.msWorkspaceActor.tileableContainer);
        }

        const oldTileableList = [...this.tileableList];
        this.tileableList.splice(this.tileableList.length - 1, 0, msWindow);

        await this.emitTileableListChangedOnce(oldTileableList);
        this.focusTileable(msWindow);
        /*  // Focusing window if the window comes from a drag and drop
        // or if there's no focused window
        if (window.grabbed || !this.windowFocused) {
        } */
    }

    async removeMsWindow(msWindow) {
        logFocus('removeMsWindow');

        if (this.msWindowList.indexOf(msWindow) === -1) return;
        const tileableIsFocused = msWindow === this.tileableFocused;
        const tileableIndex = this.tileableList.indexOf(msWindow);
        const oldTileableList = [...this.tileableList];
        oldTileableList.splice(tileableIndex, 1, [null]);
        this.tileableList.splice(tileableIndex, 1);
        if (this.focusedIndex > tileableIndex) {
            this.focusedIndex--;
        } else if (
            this.focusedIndex === this.tileableList.length - 1 &&
            this.tileableList.length > 1
        ) {
            this.focusedIndex--;
        }
        await this.emitTileableListChangedOnce(oldTileableList);
        // If there's no more focused msWindow on this workspace focus the last one
        if (tileableIsFocused) {
            this.focusTileable(this.tileableList[this.focusedIndex]);
        }
        this.refreshFocus();
    }

    async emitTileableListChangedOnce(oldTileableList) {
        if (!this.emitTileableChangedInProgress) {
            this.emitTileableChangedInProgress = new Promise((resolve) => {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    log('IDLE_ADD');
                    delete this.emitTileableChangedInProgress;
                    this.emit(
                        'tileableList-changed',
                        this.tileableList,
                        oldTileableList
                    );
                    resolve();
                    return GLib.SOURCE_REMOVE;
                });
            });
        }
        return this.emitTileableChangedInProgress;
    }

    swapTileable(firstTileable, secondTileable) {
        const firstIndex = this.tileableList.indexOf(firstTileable);
        const secondIndex = this.tileableList.indexOf(secondTileable);
        const oldTileableList = [...this.tileableList];
        this.tileableList[firstIndex] = secondTileable;
        this.tileableList[secondIndex] = firstTileable;
        this.emit('tileableList-changed', this.tileableList, oldTileableList);
    }

    focusNextTileable() {
        if (this.focusedIndex === this.tileableList.length - 1) {
            return;
        }
        this.focusTileable(this.tileableList[this.focusedIndex + 1]);
    }

    focusPreviousTileable() {
        if (this.focusedIndex === 0) {
            return;
        }
        this.focusTileable(this.tileableList[this.focusedIndex - 1]);
    }

    focusTileable(tileable) {
        if (tileable === this.tileableFocused) {
            return;
        }
        const oldTileableFocused = this.tileableFocused;
        this.focusedIndex = Math.max(this.tileableList.indexOf(tileable), 0);
        if (this.msWorkspaceManager.getActiveMsWorkspace() === this) {
            if (tileable instanceof MsWindow) {
                tileable.takeFocus();
            } else {
                tileable.grab_key_focus();
            }
        }
        this.emit('tileable-focus-changed', tileable, oldTileableFocused);
    }

    refreshFocus() {
        if (this.tileableFocused instanceof MsWindow) {
            this.tileableFocused.takeFocus();
        } else {
            this.tileableFocused.grab_key_focus();
        }
    }

    setTileableBefore(tileableToMove, tileableRelative) {
        const oldTileableList = [...this.tileableList];
        let tileableToMoveIndex = this.tileableList.indexOf(tileableToMove);
        this.tileableList.splice(tileableToMoveIndex, 1);

        let tileableRelativeIndex = this.tileableList.indexOf(tileableRelative);
        this.tileableList.splice(tileableRelativeIndex, 0, tileableToMove);
        this.emit('tileableList-changed', this.tileableList, oldTileableList);
    }

    setTileableAfter(tileableToMove, tileableRelative) {
        const oldTileableList = [...this.tileableList];
        let tileableToMoveIndex = this.tileableList.indexOf(tileableToMove);
        this.tileableList.splice(tileableToMoveIndex, 1);

        let tileableRelativeIndex = this.tileableList.indexOf(tileableRelative);
        this.tileableList.splice(tileableRelativeIndex + 1, 0, tileableToMove);
        this.emit('tileableList-changed', this.tileableList, oldTileableList);
    }

    nextTiling(direction) {
        this.tilingLayout.onDestroy();
        const Layout = Me.tilingManager.getNextLayout(
            this.tilingLayout,
            direction
        );
        this.tilingLayout = new Layout(this);
        this.msWorkspaceActor.tileableContainer.set_layout_manager(
            this.tilingLayout
        );

        this.msWorkspaceActor.panel.tilingIcon.gicon = this.tilingLayout.icon;
        this.emit('tiling-layout-changed');
    }

    shouldPanelBeVisible() {
        let containFullscreenWindow = this.msWindowList.some((msWindow) => {
            return msWindow.metaWindow
                ? msWindow.metaWindow.is_fullscreen()
                : false;
        });
        return (
            !containFullscreenWindow &&
            this.msWorkspaceManager &&
            !this.msWorkspaceManager.noUImode
        );
    }

    emitWindowsChanged(newWindows, oldWindows, debouncedArgs) {
        // In case of direct call check if it has _debouncedArgs
        if (debouncedArgs) {
            // Get first debounced oldWindows
            const firstOldWindows = debouncedArgs[0][1];
            // And compare it with the new newWindows
            if (
                newWindows.length === firstOldWindows.length &&
                newWindows.every((window, i) => firstOldWindows[i] === window)
            ) {
                // If it's the same, the changes have compensated themselves
                // So in the end nothing happened:

                return;
            }
            oldWindows = firstOldWindows;
        }

        if (!this.destroyed) {
            // Make it async to prevent concurrent debounce calls
            if (debouncedArgs) {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    log('IDLE_ADD');
                    this.emit('windows-changed', newWindows, oldWindows);
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                this.emit('windows-changed', newWindows, oldWindows);
            }
        }
    }

    setApps(apps) {
        this.apps = apps;
        this.categorizedAppCard._loadApps(apps);
    }

    isDisplayed() {
        if (this.monitor.index !== Main.layoutManager.primaryIndex) {
            return true;
        } else {
            return this === this.msWorkspaceManager.getActiveMsWorkspace();
        }
    }

    focusLastTileable() {
        if (this.tileableList.length) {
            let lastTileable =
                this.tileableList[this.focusedIndex] ||
                this.tileableList.slice(-1)[0];
            this.focusTileable(lastTileable);
        } else {
            //this.focusTileable(null);
        }
    }

    getState() {
        return {
            tilingLayout: this.tilingLayout.constructor.key,
            msWindowList: this.tileableList
                .filter((tileable) => {
                    return tileable instanceof MsWindow;
                })
                .filter((msWindow) => {
                    return !msWindow.app.is_window_backed();
                })
                .map((msWindow) => {
                    return {
                        appId: msWindow.app.get_id(),
                        metaWindowIdentifier: msWindow.metaWindowIdentifier,
                    };
                }),
        };
    }
};
Signals.addSignalMethods(MsWorkspace.prototype);

var MsWorkspaceActor = GObject.registerClass(
    {
        GTypeName: 'MsWorkspaceActor',
    },
    class MsWorkspaceActor extends Clutter.Actor {
        _init(msWorkspace) {
            log('new MsWorkspaceActor');
            super._init({
                clip_to_allocation: true,
                x_expand: true,
                background_color: new Clutter.Color({ red: 120, alpha: 255 }),
            });
            this.msWorkspace = msWorkspace;
            this.tileableContainer = new Clutter.Actor({
                background_color: new Clutter.Color({ blue: 120, alpha: 255 }),
            });

            this.panel = new TopPanel(msWorkspace);
            this.add_child(this.tileableContainer);
            this.add_child(this.panel);
        }

        vfunc_allocate(box, flags) {
            log('allocate msWorkspaceActor', box.x1, box.x2, box.y1, box.y2);
            this.set_allocation(box, flags);
            let contentBox = new Clutter.ActorBox();
            contentBox.x2 = box.get_width();
            contentBox.y2 = box.get_height();
            let panelBox = new Clutter.ActorBox();
            panelBox.x1 = contentBox.x1;
            panelBox.x2 = contentBox.x2;
            panelBox.y1 = contentBox.y1;
            panelBox.y2 = panelBox.y1 + this.panel.get_preferred_height(-1)[1];
            this.panel.allocate(panelBox, flags);
            let containerBox = new Clutter.ActorBox();
            containerBox.x1 = contentBox.x1;
            containerBox.x2 = contentBox.x2;
            containerBox.y1 =
                this.panel && this.panel.visible ? panelBox.y2 : contentBox.y1;
            containerBox.y2 = contentBox.y2;
            this.tileableContainer.allocate(containerBox, flags);
        }
    }
);
