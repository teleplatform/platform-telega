export type Leaf = string | ((...args: any[]) => string);

type Keys<T> = Extract<keyof T, string>;

export type LeafPaths<T> = T extends Leaf
  ? never
  : {
      [K in Keys<T>]: T[K] extends Leaf
        ? K
        : T[K] extends object
          ? `${K}.${LeafPaths<T[K]>}`
          : never;
    }[Keys<T>];

export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;
