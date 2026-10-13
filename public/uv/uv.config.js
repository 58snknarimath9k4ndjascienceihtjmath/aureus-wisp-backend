/*global Ultraviolet*/
const uvConfigUrl = typeof document !== "undefined" && document.currentScript
    ? document.currentScript.src
    : self.location.href;
const appRoot = new URL("../", uvConfigUrl).pathname;
const uvRoot = `${appRoot}uv/`;
self.__uv$config = {
    prefix: `${uvRoot}s/`,
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: `${uvRoot}uv.handler.js`,
    client: `${uvRoot}uv.client.js`,
    bundle: `${uvRoot}uv.bundle.js`,
    config: `${uvRoot}uv.config.js`,
    sw: `${uvRoot}uv.sw.js`,
};
