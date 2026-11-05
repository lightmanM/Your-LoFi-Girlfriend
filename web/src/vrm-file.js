export function readVRMDocument(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) throw new Error('Choose a valid binary VRM file.');
  if (buffer.byteLength > 64 * 1024 * 1024) throw new Error('This development viewer accepts files up to 64 MiB.');
  const view = new DataView(buffer);
  if (view.getUint32(0,true) !== 0x46546c67 || view.getUint32(4,true) !== 2) throw new Error('Expected a binary glTF 2.0 / VRM file.');
  const length = view.getUint32(12,true);
  if (view.getUint32(8,true) !== buffer.byteLength || view.getUint32(16,true) !== 0x4e4f534a || length > buffer.byteLength-20) throw new Error('The VRM file is truncated or malformed.');
  const document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if (!document.extensions?.VRM && !document.extensions?.VRMC_vrm) throw new Error('This is a GLB without VRM humanoid metadata. Convert it to VRM first.');
  const external = [...(document.buffers || []), ...(document.images || [])].some(item => item.uri && !item.uri.startsWith('data:'));
  if (external) throw new Error('Use a self-contained VRM with embedded textures. External resource URLs are not loaded.');
  return document;
}
