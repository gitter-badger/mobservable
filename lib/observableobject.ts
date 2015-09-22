/**
 * mobservable
 * (c) 2015 - Michel Weststrate
 * https://github.com/mweststrate/mobservable
 */

namespace mobservable {
	export namespace _ {
		// responsible for the administration of objects that have become reactive
		export class ObservableObject {
			values:{[key:string]:DataNode} = {};

			constructor(private target, private context:Mobservable.IContextInfoStruct) {
				if (target.$mobservable)
					throw new Error("Illegal state: already an reactive object");
				if (!context) {
					this.context = {
						object: target,
						name: ""
					};
				} else if (!context.object) {
					context.object = target;
				}

				Object.defineProperty(target, "$mobservable", {
					enumerable: false,
					configurable: false,
					value: this
				});
			}

			static asReactive(target, context:Mobservable.IContextInfoStruct):ObservableObject {
				if (target.$mobservable)
					return target.$mobservable;
				return new ObservableObject(target, context);
			}

			set(propName, value, mode: ValueMode) {
				if (this.values[propName])
					this.target[propName] = value; // the property setter will make 'value' reactive if needed.
				else
					this.defineReactiveProperty(propName, value, mode);
			}

			private defineReactiveProperty(propName, value, mode: ValueMode) {
				const [realmode, unwrappedValue] = _.getValueModeFromValue(value, mode);

				let observable: ObservableView<any>|ObservableValue<any>;
				let context = {
					object: this.context.object,
					name: `${this.context.name || ""}.${propName}`
				};

				if (typeof unwrappedValue === "function" && unwrappedValue.length === 0 && mode !== ValueMode.Reference)
					observable = new ObservableView(unwrappedValue, this.target, context, mode === ValueMode.Structure);
				else
					observable = new ObservableValue(unwrappedValue, realmode, context);

				this.values[propName] = observable;
				Object.defineProperty(this.target, propName, observable.asPropertyDescriptor());
			}
		}
	}
}