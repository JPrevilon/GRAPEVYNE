const HOSTED_PREVIEW_MODE = "hosted-preview";

export function isHostedPreviewMode(): boolean {
  return process.env.GRAPEVYNE_E2E_MODE === HOSTED_PREVIEW_MODE;
}
