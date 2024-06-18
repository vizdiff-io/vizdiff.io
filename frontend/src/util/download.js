export const download = (dataurl, filename) => {
  const link = document.createElement('a');
  link.href = dataurl;
  link.download = filename;
  link.click();
};

export const dataURItoBlob = (dataURI, contentType) => {
  const byteString = window.atob(dataURI);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const int8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    int8Array[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([int8Array], { type: contentType });
  return blob;
};

export const stringToBlobUrl = (string, contentType = 'text/csv') => {
  const blob = new Blob([string], { type: contentType });
  return window.URL.createObjectURL(blob);
};
