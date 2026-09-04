// MCFT-CAP-09 rolling current-crop authority selection seam.
//
// This port is intentionally read-only. It does not discover providers, write runtime
// configuration, mutate the database, activate production ownership, or authorize a
// Runtime start. Production V2 continues to use the static exact-bound snapshot unless
// a separately governed resolver is explicitly injected by a future successor.

export type McftCap09CurrentCropAuthorityJsonV1 = Record<string, unknown>;

export type McftCap09CurrentCropAuthorityResolveInputV1 = {
  logical_time: string;
};

export interface McftCap09CurrentCropAuthorityResolverPortV1 {
  resolve(
    input: McftCap09CurrentCropAuthorityResolveInputV1,
  ): McftCap09CurrentCropAuthorityJsonV1;
}

export function createStaticMcftCap09CurrentCropAuthorityResolverV1(
  snapshot: McftCap09CurrentCropAuthorityJsonV1,
): McftCap09CurrentCropAuthorityResolverPortV1 {
  return {
    resolve() {
      return snapshot;
    },
  };
}
