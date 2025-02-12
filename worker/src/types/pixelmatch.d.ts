declare module "pixelmatch" {
  function pixelmatch(
    img1: Buffer,
    img2: Buffer,
    output: Buffer,
    width: number,
    height: number,
    options?: { threshold?: number; diffColor?: [number, number, number]; diffMask?: boolean },
  ): number
  export = pixelmatch
}
