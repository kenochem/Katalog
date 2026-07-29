declare module 'jsbarcode' {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    background?: string;
    lineColor?: string;
  }

  function JsBarcode(
    element: string | HTMLElement | SVGElement,
    data: string,
    options?: JsBarcodeOptions,
  ): void;

  export default JsBarcode;
}
