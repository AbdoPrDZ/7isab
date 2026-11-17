import type featuresEn from './features.en';

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

/** Every language must provide the same feature keys as English. */
export type FeatureTranslation = DeepString<typeof featuresEn>;
