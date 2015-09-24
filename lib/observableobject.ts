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

			constructor(private target, private context:Mobservable.IContextInfoStruct, private mode: ValueMode) {
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
			static asReactive(target, context:Mobservable.IContextInfoStruct, mode:ValueMode):ObservableObject {
				if (target.$mobservable)
					return target.$mobservable;
				return new ObservableObject(target, context, mode);
			}

			set(propName, value) {
				if (this.values[propName])
					this.target[propName] = value; // the property setter will make 'value' reactive if needed.
				else
					this.defineReactiveProperty(propName, value);
			}

			private defineReactiveProperty(propName, value) {
				let observable: ObservableView<any>|ObservableValue<any>;
				let context = {
					object: this.context.object,
					name: `${this.context.name || ""}.${propName}`
				};

				if (typeof value === "function" && value.length === 0)
					observable = new ObservableView(value, this.target, context, false);
				else if (value instanceof AsStructure && typeof value.value === "function" && value.value.length === 0)
					observable = new ObservableView(value.value, this.target, context, true);
				else
					observable = new ObservableValue(value, this.mode, context);

				this.values[propName] = observable;
				Object.defineProperty(this.target, propName, observable.asPropertyDescriptor());
			}
		}
	}
}