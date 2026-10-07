/**
 * Shared leaf-geometry types.
 *
 * A leaf asset follows the shape/deformation split introduced by NeuraLeaf
 * (Yang et al., ICCV 2025, arXiv:2507.12714): a *flattened 2D base shape* — which
 * for a leaf is very nearly planar, so a 2D outline loses almost nothing — plus a
 * separate *3D deformation* that bends that flat blade into its observed pose.
 * We store the two independently for the same reason the paper separates them:
 * one leaf's outline can be posed many ways, and the physics (boundary-layer
 * trapping) responds to the pose, not just the silhouette.
 *
 * Coordinate convention, all lengths in millimetres:
 *
 *   x  transverse, across the blade (left margin negative, right margin positive)
 *   y  along the midrib, 0 at the petiole junction, +y toward the tip
 *   z  out of the flattened leaf plane (up)
 *
 * The 2D fields (`outline`, `midrib`) live in the flattened xy plane — the base
 * shape. The 1D profiles (`profile`, `camber`) carry the deformation out of it.
 */

/** A point in the flattened leaf plane, millimetres. */
export type Vec2 = readonly [number, number];

/** A point in 3D leaf space, millimetres. */
export type Vec3 = readonly [number, number, number];

/**
 * Pose knobs applied on top of whatever deformation the asset already carries.
 * These stand in for a traversal of NeuraLeaf's deformation latent z_d: the model
 * produces one observed pose per fitted leaf, and these let the tools sweep around
 * it without re-running the network. Identity is {@link NEUTRAL_DEFORM}.
 */
export interface DeformParams {
  /** Extra margin roll, in units of local half-width. Positive curls the margins up. */
  curl: number;
  /** Multiplier on the asset's own transverse cupping (1 = as fitted, 0 = flat). */
  cup: number;
  /** Twist about the midrib, radians accumulated from base to tip. */
  twist: number;
  /** Extra arch along the midrib, in units of blade length. Negative droops down. */
  droop: number;
  /** Multiplier on the asset's blade thickness. */
  thicknessScale: number;
}

export const NEUTRAL_DEFORM: DeformParams = {
  curl: 0,
  cup: 1,
  twist: 0,
  droop: 0,
  thicknessScale: 1,
};

/** Scalar morphometrics, recomputed from the outline on load rather than trusted. */
export interface LeafTraits {
  areaMm2: number;
  /** Midrib arclength, base to tip. */
  lengthMm: number;
  /** Widest chord across the blade. */
  widthMm: number;
  aspectRatio: number;
  perimeterMm: number;
}

/** Where the geometry came from. Every asset must be able to answer this. */
export interface LeafProvenance {
  /** Imaging series identifier, e.g. 'Gravi_02'. */
  series: string;
  /** Frame index within the series, when the asset came from a timelapse. */
  frame?: number;
  /** ISO timestamp of the source frame. */
  timestamp?: string;
  /**
   * Hours since the first frame of the series. This is elapsed imaging time, NOT
   * a developmental or senescence stage — see leaf-assets PROVENANCE.md.
   */
  ageHours?: number;
  /** Free-text note: segmentation method, operator, caveats. */
  note?: string;
}

/** The NeuraLeaf fit that produced this geometry, when one was used. */
export interface NeuraLeafFit {
  /** Checkpoint filename, e.g. 'baseshape_l.pth'. */
  checkpoint: string;
  /** Base-shape latent z_s. */
  zShape: number[];
  /** Deformation latent z_d. */
  zDeform: number[];
  /** Fit residual reported by fitting.py, millimetres. */
  chamferMm: number;
}

export interface LeafAsset {
  id: string;
  label: string;
  /**
   * True while the asset is a hand-authored stand-in rather than a fit to real
   * imagery. Provisional assets must never back a published number.
   */
  provisional: boolean;
  source: LeafProvenance;
  neuraleaf?: NeuraLeafFit;
  /** Closed outline of the flattened blade, CCW, first point not repeated. */
  outline: Vec2[];
  /** Midrib polyline from base to tip. */
  midrib: Vec2[];
  /**
   * Midrib height out of plane: [s, z] with s the normalised arclength along the
   * midrib (0 at base, 1 at tip) and z in mm. Carries arch and droop.
   */
  profile: Vec2[];
  /**
   * Transverse cupping at the widest chord: [t, z] with t from -1 (left margin)
   * through 0 (midrib) to +1 (right margin), z in mm relative to the midrib.
   * Scaled by local half-width when lofted, so a narrow base cups less than the
   * widest part of the blade.
   */
  camber: Vec2[];
  /** Blade thickness, millimetres. */
  thicknessMm: number;
  traits?: Partial<LeafTraits>;
}
