/** Gnome libs imports */
const Signals = imports.signals;

/** Extension imports */
const Me = imports.misc.extensionUtils.getCurrentExtension();
/* exported MsManager */
var MsManager = class MsManager {
    constructor() {
        this.signals = [];
    }
    observe(subject, property, callback) {
        let signal = {
            from: subject,
            id: subject.connect(property, callback),
        };
        this.signals.push(signal);
        return () => {
            subject.disconnect(signal.id);
        };
    }
    destroy() {
        this.signals.forEach((signal) => {
            if (signal.from) {
                try {
                    signal.from.disconnect(signal.id);
                } catch {
                    log(
                        `Failed to disconnect signal ${signal.id} from ${
                            signal.from
                        } ${
                            signal.from.constructor.name
                        }`
                    );
                }
            }
        });
    }
};
Signals.addSignalMethods(MsManager.prototype);
