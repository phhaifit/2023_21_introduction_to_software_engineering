export type SafeJsonValue =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: SafeJsonValue }
  | readonly SafeJsonValue[];

