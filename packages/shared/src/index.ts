export * from "./constants";
export * from "./content";
export * from "./api";
export * from "./games";

/** Channel id for a neighborhood's group chat ("the porch"). */
export const neighborhoodChannel = (neighborhoodId: string) => `nb_${neighborhoodId}`;

/** Channel id for a direct conversation; order-independent. */
export const directChannel = (a: string, b: string) => `dm_${[a, b].sort().join("_")}`;
