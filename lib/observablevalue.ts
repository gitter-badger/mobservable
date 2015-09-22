/**
 * mobservable
 * (c) 2015 - Michel Weststrate
 * https://github.com/mweststrate/mobservable
 */

namespace mobservable {
    export namespace _ {
        export class ObservableValue<T> extends DataNode {
            protected changeEvent = new SimpleEventEmitter();
            protected _value: T;

            constructor(protected value:T, protected mode:ValueMode, context:Mobservable.IContextInfoStruct){
                super(context);
                this._value = this.makeReferenceValueReactive(value);
            }

            private makeReferenceValueReactive(value) {
                if (isValueModeRecursive(this.mode) && (Array.isArray(value) || isPlainObject(value))) {
                    return makeReactive(value, {
                        context: this.context.object,
                        name: this.context.name
                    });
                }
                return value;
            }

            set(newValue:T) {
                if (_.isComputingView()) {
                    var ts = __mobservableViewStack;
                    console.error(`[mobservable.value '${this.context.name}'] It is not allowed to change the state during the computation of a reactive view. (stack size is ${ts.length}, active view: "${ts[ts.length -1].toString()}")`);
                    console.trace();
                }
                const changed = this.mode === ValueMode.Structure ? !deepEquals(newValue, this._value) : newValue !== this._value;
                // Possible improvement; even if changed and structural, apply the minium amount of updates to alter the object,
                // To minimize the amount of observers triggered.
                // Complex. Is that a useful case?
                if (changed) {
                    var oldValue = this._value;
                    this.markStale();
                    this._value = this.makeReferenceValueReactive(newValue);
                    this.markReady(true);
                    this.changeEvent.emit(this._value, oldValue);
                }
            }

            get():T {
                this.notifyObserved();
                return this._value;
            }

            observe(listener:(newValue:T, oldValue:T)=>void, fireImmediately=false):Lambda {
                if (fireImmediately)
                    listener(this.get(), undefined);
                return this.changeEvent.on(listener);
            }

            asPropertyDescriptor(): PropertyDescriptor {
                return {
                    configurable: false,
                    enumerable: true,
                    get: () => this.get(),
                    set: (value) => this.set(value)
                }
            }

            toString() {
                return `Observable[${this.context.name}:${this._value}]`;
            }
        }
    }
}
