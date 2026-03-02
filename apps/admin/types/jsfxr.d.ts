declare module 'jsfxr' {
  export type JsfxrSynthDef = Record<string, number>;

  export type JsfxrWave = {
    wav: number[];
    dataURI: string;
  };

  export type JsfxrApi = {
    toWave: (synthdef: JsfxrSynthDef) => JsfxrWave;
    toWebAudio: (
      synthdef: JsfxrSynthDef,
      context: AudioContext,
    ) => AudioBufferSourceNode | undefined;
  };

  export type JsfxrModule = {
    sfxr: JsfxrApi;
    parameters: {
      order: string[];
    };
  };

  const jsfxr: JsfxrModule;
  export default jsfxr;
}
