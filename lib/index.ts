/**
 * mobservable
 * (c) 2015 - Michel Weststrate
 * https://github.com/mweststrate/mobservable
 */

namespace mobservable {

    export type Lambda = Mobservable.Lambda;

    export function makeReactive(v:any, opts?:Mobservable.IMakeReactiveOptions) {
        if (isReactive(v))
            return v;

        opts = opts || {};
        let [mode, value] = _.getValueModeFromValue(v, _.ValueMode.Recursive);

        // TODO: deprecate these options
        if (opts.recurse === false)
            mode = _.ValueMode.Flat;
        else if (opts.as === "reference")
            mode = _.ValueMode.Reference;

        const sourceType = mode === _.ValueMode.Reference ? _.ValueType.Reference : _.getTypeOfValue(value);
        const context = {
            name: opts.name,
            object: opts.context || opts.scope
        };

        switch(sourceType) {
            case _.ValueType.Reference:
            case _.ValueType.ComplexObject:
                return _.toGetterSetterFunction(new _.ObservableValue(value, mode, context));
            case _.ValueType.ComplexFunction:
                throw new Error("[mobservable.makeReactive] Creating reactive functions from functions with multiple arguments is currently not supported, see https://github.com/mweststrate/mobservable/issues/12");
            case _.ValueType.ViewFunction:
                if (!context.name)
                    context.name = value.name;
                return _.toGetterSetterFunction(new _.ObservableView(value, opts.scope || opts.context, context, mode === _.ValueMode.Structure));
            case _.ValueType.Array:
                return new _.ObservableArray(<[]>value, mode, context);
            case _.ValueType.PlainObject:
                return _.extendReactive({}, value, mode, context);
        }
        throw "Illegal State";
    }

    export function asReference(value) {
        return new _.AsReference(value);
    }

    export function asStructure(value) {
        return new _.AsStructure(value);
    }

    export function isReactive(value):boolean {
        if (value === null || value === undefined)
            return false;
        return !!value.$mobservable;
    }

    export function sideEffect(func:Lambda, scope?:any):Lambda {
        // TODO: add deprecation warning
        return observe(func, scope);
    }

    export function observe(view:Lambda, scope?:any):Lambda {
        var [mode, unwrappedView] = _.getValueModeFromValue(view, _.ValueMode.Recursive);
        const observable = new _.ObservableView(unwrappedView, scope, {
            object: scope,
            name: view.name
        }, mode === _.ValueMode.Structure);
        observable.setRefCount(+1);

        const disposer = _.once(() => {
            observable.setRefCount(-1);
            // TODO: observable.dispose?
        });
        if (logLevel >= 2 && observable.observing.length === 0)
            console.warn(`[mobservable.sideEffect] not a single observable was used inside the side-effect function. Side-effect would be a no-op.`);
        (<any>disposer).$mobservable = observable;
        return disposer;
    }

    export function observeUntil(predicate: ()=>boolean, effect: Mobservable.Lambda, scope?: any): Mobservable.Lambda {
        const disposer = observe(() => {
            if (predicate.call(scope)) {
                disposer();
                effect.call(scope);
            }
        });
        return disposer;
    }

    export function observeAsync<T>(view: () => T, effect: (latestValue : T ) => void, delay:number = 1, scope?: any): Lambda {
        var latestValue: T = undefined;
        var timeoutHandle;

        const disposer = observe(() => {
            latestValue = view.call(scope);
            if (!timeoutHandle) {
                timeoutHandle = setTimeout(() => {
                    effect.call(scope, latestValue);
                    timeoutHandle = null;
                }, delay);
            }
        });

        return _.once(() => {
            disposer();
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
        });
    }

    export function when(predicate: ()=>boolean, effect: Mobservable.Lambda, scope?: any): Mobservable.Lambda {
        console.error("[mobservable.when] deprecated, please use 'mobservable.observeUntil'");
        return observeUntil(predicate, effect, scope);
    }

    export function extendReactive(target:Object, properties:Object, context?:Mobservable.IContextInfoStruct):Object {
        return _.extendReactive(target, properties, _.ValueMode.Recursive, context); // No other mode makes sense..?
    }

    /**
     * Use this annotation to wrap properties of an object in an observable, for example:
     * class OrderLine {
     *   @observable amount = 3;
     *   @observable price = 2;
     *   @observable total() {
     *      return this.amount * this.price;
     *   }
     * }
     */
    export function observable(target:Object, key:string, descriptor?) {
        // observable annotations are invoked on the prototype, not on actual instances,
        // so upon invocation, determine the 'this' instance, and define a property on the
        // instance as well (that hides the propotype property)
        var baseValue = descriptor ? descriptor.value : null;
        if (typeof baseValue === "function")
            throw new Error("@observable functions are deprecated. Use @observable (getter) properties instead");
        if (descriptor && descriptor.set)
            throw new Error("@observable properties cannot have a setter.");
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable:true,
            get: function() {
                _.ObservableObject.asReactive(this, null).set(key, undefined, _.ValueMode.Recursive);
                return this[key];
            },
            set: function(value) {
                _.ObservableObject.asReactive(this, null).set(key, value, _.ValueMode.Recursive);
            }
        });
    }

    /**
     * Basically, a deep clone, so that no reactive property will exist anymore.
     * Doesn't follow references.
     */
    export function toJSON(source) {
        if (!source)
            return source;
        if (Array.isArray(source) || source instanceof _.ObservableArray)
            return source.map(toJSON);
        if (typeof source === "object" && _.isPlainObject(source)) {
            var res = {};
            for (var key in source) if (source.hasOwnProperty(key))
                res[key] = toJSON(source[key]);
            return res;
        }
        return source;
    }

    export function toJson(source) {
        console.warn("mobservable.toJson is deprecated, use mobservable.toJSON instead");
        return toJSON(source);
    }

    export function transaction<T>(action:()=>T):T {
        return _.Scheduler.batch(action);
    }

    /**
        Evaluates func and return its results. Watch tracks all observables that are used by 'func'
        and invokes 'onValidate' whenever func *should* update.
        Returns  a tuplde [return value of func, disposer]. The disposer can be used to abort the watch early.
    */
    export function observeUntilInvalid<T>(func:()=>T, onInvalidate:Lambda, context?:Mobservable.IContextInfo):[T,Lambda, any] {
        console.warn("mobservable.observeUntilInvalid is deprecated and will be removed in 0.7");
        var hasRun = false;
        var result;
        var disposer = sideEffect(() => {
            if (!hasRun) {
                hasRun = true;
                result = func();
            } else {
                onInvalidate();
            }
        });
        return [result, disposer, disposer['$mobservable']];
    }

    export var logLevel = 1; // 0 = production, 1 = development, 2 = debugging

    setTimeout(function() {
        if (logLevel > 0)
            console.info(`Welcome to mobservable. Current logLevel = ${logLevel}. Change mobservable.logLevel according to your needs: 0 = production, 1 = development, 2 = debugging`);
    }, 1);

    export namespace _ {
        export enum ValueType { Reference, PlainObject, ComplexObject, Array, ViewFunction, ComplexFunction }

        export enum ValueMode { Flat, Recursive, Reference, Structure }

        export function getTypeOfValue(value): ValueType {
            if (value === null || value === undefined)
                return ValueType.Reference;
            if (typeof value === "function")
                return value.length ? ValueType.ComplexFunction : ValueType.ViewFunction;
            if (Array.isArray(value) || value instanceof _.ObservableArray)
                return ValueType.Array;
            if (typeof value == 'object')
                return _.isPlainObject(value) ? ValueType.PlainObject : ValueType.ComplexObject;
            return ValueType.Reference; // safe default, only refer by reference..
        }

        export function extendReactive(target, properties, mode:_.ValueMode, context: Mobservable.IContextInfoStruct):Object {
            var meta = _.ObservableObject.asReactive(target, context);
            for(var key in properties) if (properties.hasOwnProperty(key)) {
                var [realMode, unwrappedValue] = getValueModeFromValue(properties[key], mode);
                meta.set(key, unwrappedValue, realMode);
            }
            return target;
        }

        export function toGetterSetterFunction<T>(observable: _.ObservableValue<T>|_.ObservableView<T>):Mobservable.IObservableValue<T> {
            var f:any = function(value?) {
                if (arguments.length > 0)
                    observable.set(value);
                else
                    return observable.get();
            };
            f.$mobservable = observable;
            f.observe = function(listener, fire) {
                return observable.observe(listener, fire);
            }
            f.toString = function() {
                return observable.toString();
            }
            return f;
        }

        export class AsReference {
            constructor(public value:any) {
                 if (value instanceof _.AsStructure)
                    throw new Error("[mobservable.asReference] asStructure and asReference cannot be mixed");
            }
        }

        export class AsStructure {
            constructor(public value:any) {
                 if (value instanceof _.AsReference)
                    throw new Error("[mobservable.asStructure] asStructure and asReference cannot be mixed");
            }
        }

        export function getValueModeFromValue(value:any, defaultMode:ValueMode): [ValueMode, any] {
            if (value instanceof AsReference)
                return [ValueMode.Reference, value.value];
            if (value instanceof AsStructure)
                return [ValueMode.Structure, value.value];
            return [defaultMode, value];
        }

        export function isValueModeRecursive(mode:ValueMode): boolean {
            switch(mode) {
                case ValueMode.Recursive:
                case ValueMode.Structure:
                    return true;
                default:
                    return false;
            }
        }
    }
}
