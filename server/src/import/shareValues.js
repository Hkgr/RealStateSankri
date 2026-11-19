// Each owner's value in a purchase, by shares:
//   value = Kashf 16 value × the owner's shares ÷ the parcel's shares
// The sheet's own "value" columns round the joint (undivided) parcels to exactly 75% / 25%, while the
// shares written beside them are a little different (e.g. 86.864 of 115.819), so the shares are the
// exact basis. The formula is used only when the shares agree with the parcel's ownership label; where
// they are missing or contradict it, the sheet's own figures stay and the parcel is reported (`conflict`).

const round3 = (value) => Math.round(value * 1000) / 1000
const positive = (value) => value != null && value > 0

/** Do the shares written for the parcel tell the same story as its ownership label? */
function sharesAgree(group, total, sankari, asali) {
  if (Math.abs((sankari ?? 0) + (asali ?? 0) - total) > 0.01) return false
  if (group === 'joint_75_25') return positive(sankari) && positive(asali)
  if (group === 'sankari_100') return positive(sankari) && !positive(asali)
  if (group === 'asali_100') return positive(asali) && !positive(sankari)
  return true
}

/**
 * @param {{k16ValueUsd: number|null, totalShares: number|null, sankariShares: number|null, asaliShares: number|null,
 *          ownershipGroup?: string, sankariValueUsd: number|null, asaliValueUsd: number|null}} figures
 * @returns {{sankariValueUsd: number|null, asaliValueUsd: number|null, fromShares: boolean, conflict: boolean}}
 */
export function splitByShares(figures) {
  const { k16ValueUsd: value, totalShares: total, sankariShares, asaliShares, ownershipGroup } = figures
  const keep = { sankariValueUsd: figures.sankariValueUsd, asaliValueUsd: figures.asaliValueUsd, fromShares: false, conflict: false }
  if (value == null || !(total > 0) || (sankariShares == null && asaliShares == null)) return keep
  if (!sharesAgree(ownershipGroup, total, sankariShares, asaliShares)) return { ...keep, conflict: true }
  const part = (shares) => (shares == null ? null : round3((value * shares) / total))
  return { sankariValueUsd: part(sankariShares) ?? keep.sankariValueUsd, asaliValueUsd: part(asaliShares) ?? keep.asaliValueUsd, fromShares: true, conflict: false }
}
