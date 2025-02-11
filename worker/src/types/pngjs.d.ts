declare module "pngjs" {
  export class PNG {
    static sync: {
      read(buffer: Buffer): PNG
      write(png: PNG): Buffer
    }
    constructor(options?: { width?: number; height?: number })
    width: number
    height: number
    data: Buffer
  }
}
