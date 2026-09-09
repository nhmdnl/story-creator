export const base64ToBlobUrl = (dataUrlOrBase64: string, mimeType: string = 'image/png') => {
  if (dataUrlOrBase64.startsWith('blob:')) return dataUrlOrBase64;
  
  let base64 = dataUrlOrBase64;
  if (dataUrlOrBase64.startsWith('data:')) {
    const parts = dataUrlOrBase64.split(',');
    base64 = parts[1];
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mimeType = mimeMatch[1];
  }
  
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
  if (blobUrl.startsWith('data:')) return blobUrl;
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const serializeNodes = async (nodes: any[]) => {
  const newNodes = JSON.parse(JSON.stringify(nodes));
  for (const node of newNodes) {
    if (node.data) {
      if (node.data.referenceImage && node.data.referenceImage.startsWith('blob:')) {
        node.data.referenceImage = await blobUrlToBase64(node.data.referenceImage);
      }
      if (node.data.referenceImages) {
        node.data.referenceImages = await Promise.all(
          node.data.referenceImages.map(async (img: string) => 
            img.startsWith('blob:') ? await blobUrlToBase64(img) : img
          )
        );
      }
      if (node.data.images) {
        node.data.images = await Promise.all(
          node.data.images.map(async (img: string) => 
            img.startsWith('blob:') ? await blobUrlToBase64(img) : img
          )
        );
      }
      if (node.data.styleReferenceImage && node.data.styleReferenceImage.startsWith('blob:')) {
        node.data.styleReferenceImage = await blobUrlToBase64(node.data.styleReferenceImage);
      }
      if (node.data.characters) {
        for (const char of node.data.characters) {
           if (char.referenceImages) {
             char.referenceImages = await Promise.all(
               char.referenceImages.map(async (img: string) => 
                 img.startsWith('blob:') ? await blobUrlToBase64(img) : img
               )
             );
           }
        }
      }
    }
  }
  return newNodes;
};

export const deserializeNodes = (nodes: any[]) => {
  const newNodes = JSON.parse(JSON.stringify(nodes));
  for (const node of newNodes) {
    if (node.data) {
      if (node.data.referenceImage && !node.data.referenceImage.startsWith('blob:')) {
        node.data.referenceImage = base64ToBlobUrl(node.data.referenceImage);
      }
      if (node.data.referenceImages) {
        node.data.referenceImages = node.data.referenceImages.map((img: string) => 
          !img.startsWith('blob:') ? base64ToBlobUrl(img) : img
        );
      }
      if (node.data.images) {
        node.data.images = node.data.images.map((img: string) => 
          !img.startsWith('blob:') ? base64ToBlobUrl(img) : img
        );
      }
      if (node.data.styleReferenceImage && !node.data.styleReferenceImage.startsWith('blob:')) {
        node.data.styleReferenceImage = base64ToBlobUrl(node.data.styleReferenceImage);
      }
      if (node.data.characters) {
        for (const char of node.data.characters) {
           if (char.referenceImages) {
             char.referenceImages = char.referenceImages.map((img: string) => 
               !img.startsWith('blob:') ? base64ToBlobUrl(img) : img
             );
           }
        }
      }
    }
  }
  return newNodes;
};
