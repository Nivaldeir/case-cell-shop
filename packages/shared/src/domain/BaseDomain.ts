export abstract class BaseDomain<T> {
	private readonly props: T;

	constructor(props: T) {
		this.props = props;
	}

	get(): T;

	get<K extends keyof T>(key: K): T[K];

	get<K extends keyof T>(key?: K): T | T[K] {
		if (key !== undefined) return this.props[key];
		return this.props;
	}

	set<K extends keyof T>(key: K, value: T[K]): void {
		this.props[key] = value;
	}

	toJSON(): T {
		return Object.freeze({ ...this.props });
	}
}

export abstract class BaseValueObject<T> extends BaseDomain<T> {}
